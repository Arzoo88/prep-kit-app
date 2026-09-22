export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBackoff(fn, { maxAttempts = 4, baseDelayMs = 500, isRetryable = defaultIsRetryable } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const retryAfter = parseRetryAfter(err.retryAfterHeader);
      const delay = retryAfter ?? baseDelayMs * 2 ** (attempt - 1) + Math.random() * 250;
      await sleep(delay);
    }
  }
  throw lastErr;
}

function parseRetryAfter(header) {
  if (!header) return null;
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds)) return asSeconds * 1000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function defaultIsRetryable(err) {
  const status = err.status || err.statusCode;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') return true;
  return false;
}

class HostLimiter {
  constructor(minIntervalMs = 400) {
    this.minIntervalMs = minIntervalMs;
    this.lastRequestAt = new Map();
  }

  async wait(host) {
    const last = this.lastRequestAt.get(host) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt.set(host, Date.now());
  }
}

export const hostLimiter = new HostLimiter();

class SimpleThrottle {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.nextAvailableAt = 0;
  }

  async wait() {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.minIntervalMs;
    if (waitMs > 0) await sleep(waitMs);
  }
}

export const llmThrottle = new SimpleThrottle(2200);