/**
 * In-memory sliding window rate limiter for security abuse prevention.
 * Default: 15 requests per 60 seconds per user/IP.
 */

interface RateLimitRecord {
  timestamps: number[];
}

declare global {
  var __talaba_rate_limits__: Map<string, RateLimitRecord> | undefined;
}

const store: Map<string, RateLimitRecord> =
  globalThis.__talaba_rate_limits__ ||
  (globalThis.__talaba_rate_limits__ = new Map<string, RateLimitRecord>());

// Periodic cleanup of stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeStale(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  limit: number = 15,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  purgeStale(windowMs);

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.timestamps.push(now);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
  };
}

/** Helper to reset rate limit for a key (useful for tests) */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
