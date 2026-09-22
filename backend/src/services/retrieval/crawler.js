import { fetchPage } from './fetchPage.js';
import { isAllowedByRobots } from './robots.js';

// Paths and link-text signals that make a link worth following when hunting
// for a company's hiring / "how we interview" content. This is a *ranking*
// heuristic, not a fixed path list (the brief explicitly forbids hard-coding
// paths) - it just decides crawl order, and every discoverable page under
// the same origin is still eligible.
const HIRING_SIGNALS = [
  /career/i, /jobs?/i, /join-?us/i, /hiring/i, /work-with-us/i,
  /interview/i, /recruit/i, /team/i, /culture/i, /life-at/i, /handbook/i,
  /engineering-?blog/i, /blog/i, /about/i,
];

function scoreLink(link, anchorText = '') {
  const haystack = `${link} ${anchorText}`;
  let score = 0;
  for (const re of HIRING_SIGNALS) {
    if (re.test(haystack)) score += 1;
  }
  return score;
}

/**
 * Crawls a company site breadth-first starting from its homepage, looking
 * for an "about" page and a hiring / interview-process page. Ranks
 * discovered links by how hiring-related they look and fetches the most
 * promising ones first, rather than assuming any fixed path exists.
 *
 * Returns { pagesUsed, aboutPage, hiringPage, skipped } - `skipped` records
 * every source that could not be retrieved, per Section 2 ("skip and report
 * a source that cannot be retrieved, rather than failing the whole run").
 */
export async function crawlCompanySite(companyUrl, { maxPages = 8, allowLoopback = false } = {}) {
  const visited = new Set();
  const skipped = [];
  const pagesUsed = [];
  let hiringPage = null;
  let aboutPage = null;

  const home = await fetchPage(companyUrl, { allowLoopback });
  if (!home.ok) {
    skipped.push({ url: companyUrl, reason: home.reason, message: home.message });
    return { pagesUsed, aboutPage, hiringPage, skipped };
  }
  visited.add(home.url);
  pagesUsed.push({ url: home.url, title: home.title, text: home.text });
  if (/about|who we are|what we do/i.test(home.title + home.text.slice(0, 500))) {
    aboutPage = pagesUsed[0];
  }

  const origin = new URL(home.url).origin;
  const frontier = home.links
    .filter((l) => l.startsWith(origin))
    .map((l) => ({ url: l, score: scoreLink(l) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  for (const candidate of frontier) {
    if (pagesUsed.length >= maxPages) break;
    if (visited.has(candidate.url)) continue;
    visited.add(candidate.url);

    const allowed = await isAllowedByRobots(candidate.url).catch(() => true);
    if (!allowed) {
      skipped.push({ url: candidate.url, reason: 'ROBOTS_DISALLOWED', message: 'Blocked by robots.txt' });
      continue;
    }

    const page = await fetchPage(candidate.url, { allowLoopback });
    if (!page.ok) {
      skipped.push({ url: candidate.url, reason: page.reason, message: page.message });
      continue;
    }

    pagesUsed.push({ url: page.url, title: page.title, text: page.text });

    if (!aboutPage && /about|what we do|our mission/i.test(page.title)) {
      aboutPage = { url: page.url, title: page.title, text: page.text };
    }
    if (/career|hiring|interview|job/i.test(page.title + page.url) && !hiringPage) {
      hiringPage = { url: page.url, title: page.title, text: page.text };
    }
  }

  return { pagesUsed, aboutPage, hiringPage, skipped };
}
