/* Per-IP token-bucket rate limiter.
 *
 * NOTE: state is per-instance (in-memory). For a single, low-traffic Cloud Run
 * service with a small --max-instances this is a fine approximation. If you scale
 * out, move this to a shared store (e.g. Memorystore/Redis) so limits are global.
 */
export function createRateLimiter({ capacity = 20, refillPerSec = 20 / 60, sweepMs = 600000 } = {}) {
  const buckets = new Map();

  // Drop idle buckets so the map can't grow without bound.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets) if (now - b.last > sweepMs) buckets.delete(ip);
  }, sweepMs);
  timer.unref?.();

  return function allow(ip) {
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b) { b = { tokens: capacity, last: now }; buckets.set(ip, b); }
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}
