import fetch from 'node-fetch';
import robotsParser from 'robots-parser';

const cache = new Map();

export async function isAllowedByRobots(url, userAgent = 'AIInterviewPrepKitBot') {
  const origin = new URL(url).origin;
  if (!cache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await fetch(robotsUrl, { headers: { 'User-Agent': userAgent } });
      const body = res.ok ? await res.text() : '';
      cache.set(origin, robotsParser(robotsUrl, body));
    } catch {
      // If robots.txt can't be fetched, don't block on it - but we did try,
      // which is the good-faith standard most crawlers hold themselves to.
      cache.set(origin, robotsParser(robotsUrl, ''));
    }
  }
  const parser = cache.get(origin);
  return parser.isAllowed(url, userAgent) !== false;
}
