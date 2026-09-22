import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { assertSafeUrl, MAX_RESPONSE_BYTES, ALLOWED_CONTENT_TYPES } from '../security/urlValidation.js';
import { withBackoff, hostLimiter } from '../security/rateLimiter.js';

const USER_AGENT = 'AIInterviewPrepKitBot/1.0 (+https://trao.example/bot)';

/**
 * Fetches a single URL, validates it, respects a size/content-type cap, and
 * returns cleaned text + the links found on the page. Never throws for
 * ordinary retrieval failures (404, timeout, wrong content-type) - instead
 * returns { ok: false, reason } so a caller can "skip and report" per
 * Section 2, rather than failing the whole run.
 */
export async function fetchPage(rawUrl, { allowLoopback = false, timeoutMs = 8000 } = {}) {
  let url;
  try {
    url = await assertSafeUrl(rawUrl, { allowLoopback });
  } catch (err) {
    return { ok: false, url: rawUrl, reason: err.code || 'INVALID_URL', message: err.message };
  }

  await hostLimiter.wait(url.hostname);

  try {
    const response = await withBackoff(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'follow',
          signal: controller.signal,
        });
        if (!res.ok && res.status !== 404) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return res;
      } finally {
        clearTimeout(timer);
      }
    });

    if (response.status === 404) {
      return { ok: false, url: url.toString(), reason: 'NOT_FOUND', message: '404 Not Found' };
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return { ok: false, url: url.toString(), reason: 'UNSUPPORTED_CONTENT_TYPE', message: contentType };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      return { ok: false, url: url.toString(), reason: 'TOO_LARGE', message: 'Response exceeded size cap' };
    }

    const html = Buffer.from(buffer).toString('utf-8');
    const $ = cheerio.load(html);
    $('script, style, noscript, svg').remove();

    const title = $('title').first().text().trim();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20000);

    const links = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const abs = new URL(href, url).toString();
        links.add(abs);
      } catch {
        // ignore malformed relative links
      }
    });

    return { ok: true, url: url.toString(), title, text, links: [...links] };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'TIMEOUT' : 'UNREACHABLE';
    return { ok: false, url: url.toString(), reason, message: err.message };
  }
}
