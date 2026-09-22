import fetch from 'node-fetch';
import { env } from '../../config/env.js';
import { withBackoff } from '../security/rateLimiter.js';

/**
 * Looks for public discussion of a company's interview process (Glassdoor
 * threads, blog posts, Reddit, etc.) via a pluggable web-search API. If no
 * SEARCH_API_KEY is configured, this is skipped gracefully and reported as
 * "not searched" rather than fabricating results - see Section 10, "public
 * discussion of the company turns up nothing at all".
 */
export async function searchPublicDiscussion(companyName) {
  if (!env.search.apiKey || !env.search.baseUrl) {
    return { searched: false, results: [] };
  }

  try {
    const results = await withBackoff(async () => {
      const res = await fetch(`${env.search.baseUrl}?q=${encodeURIComponent(`${companyName} interview process experience`)}`, {
        headers: { Authorization: `Bearer ${env.search.apiKey}` },
      });
      if (!res.ok) {
        const err = new Error(`Search API HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    });

    const items = (results.results || results.items || []).slice(0, 5).map((r) => ({
      title: r.title || '',
      url: r.url || r.link || '',
      snippet: (r.snippet || r.description || '').slice(0, 500),
    }));

    return { searched: true, results: items };
  } catch (err) {
    return { searched: true, results: [], error: err.message };
  }
}
