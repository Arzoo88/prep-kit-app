import net from 'node:net';
import dns from 'node:dns/promises';

// Blocks the usual SSRF footguns: private/loopback/link-local ranges and
// non-http(s) schemes. In development against `localhost:8099` fixtures
// (as Appendix B's batch cases do) we allow loopback explicitly, because
// the assessment's own test harness serves company sites from a local
// address - see Section 9. In production this exception is off.
const PRIVATE_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
];

function isPrivateIPv4(ip) {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '::1';
}

export async function assertSafeUrl(rawUrl, { allowLoopback = false } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error(`Invalid URL: ${rawUrl}`), { code: 'INVALID_URL' });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error(`Unsupported protocol: ${url.protocol}`), { code: 'INVALID_URL' });
  }

  if (isLoopbackHost(url.hostname)) {
    if (allowLoopback) return url;
    throw Object.assign(new Error('Loopback addresses are not allowed.'), { code: 'PRIVATE_ADDRESS' });
  }

  if (net.isIP(url.hostname)) {
    if (isPrivateIPv4(url.hostname)) {
      throw Object.assign(new Error('Private IP addresses are not allowed.'), { code: 'PRIVATE_ADDRESS' });
    }
    return url;
  }

  // Resolve the hostname and reject if it points at a private address,
  // guarding against DNS rebinding to an internal service.
  try {
    const records = await dns.lookup(url.hostname, { all: true });
    if (records.some((r) => isPrivateIPv4(r.address))) {
      if (!allowLoopback) {
        throw Object.assign(new Error('Host resolves to a private address.'), { code: 'PRIVATE_ADDRESS' });
      }
    }
  } catch (err) {
    if (err.code === 'PRIVATE_ADDRESS') throw err;
    // DNS failure - let the fetch layer surface it as UNREACHABLE.
  }

  return url;
}

export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3MB cap per page
export const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];
