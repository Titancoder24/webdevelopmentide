import { createMiddleware } from 'hono/factory';
import type { GatewayEnv, RateLimitResult, TokenBucket } from './types.js';

/**
 * In-memory token bucket store, keyed by token_id.
 * Will be replaced with Redis Lua script in production for distributed rate limiting.
 */
const buckets = new Map<string, TokenBucket>();

/**
 * Get or create a token bucket for a given key.
 */
function getOrCreateBucket(
  key: string,
  capacity: number,
  refillRate: number
): TokenBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      tokens: capacity,
      last_refill: Date.now(),
      capacity,
      refill_rate: refillRate,
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

/**
 * Refill tokens in the bucket based on elapsed time.
 */
function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = now - bucket.last_refill;
  const tokensToAdd = (elapsed / 1000) * bucket.refill_rate;

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.last_refill = now;
  }
}

/**
 * Attempt to consume a token from the bucket.
 */
function consumeToken(bucket: TokenBucket, cost: number = 1): RateLimitResult {
  refillBucket(bucket);

  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      reset_at: bucket.last_refill + Math.ceil((bucket.capacity - bucket.tokens) / bucket.refill_rate) * 1000,
    };
  }

  const deficit = cost - bucket.tokens;
  const retryAfterMs = Math.ceil((deficit / bucket.refill_rate) * 1000);

  return {
    allowed: false,
    remaining: 0,
    reset_at: Date.now() + retryAfterMs,
    retry_after_ms: retryAfterMs,
  };
}

/**
 * Clear all buckets (useful for testing).
 */
export function clearBuckets(): void {
  buckets.clear();
}

/**
 * Check rate limit for a specific key without consuming a token.
 */
export function peekRateLimit(
  key: string,
  capacity: number,
  refillRate: number
): RateLimitResult {
  const bucket = getOrCreateBucket(key, capacity, refillRate);
  refillBucket(bucket);

  return {
    allowed: bucket.tokens >= 1,
    remaining: Math.floor(bucket.tokens),
    reset_at: bucket.last_refill + Math.ceil((bucket.capacity - bucket.tokens) / bucket.refill_rate) * 1000,
  };
}

/**
 * Programmatic rate limit check and consume.
 */
export function checkRateLimit(
  key: string,
  capacity: number,
  refillRate: number,
  cost: number = 1
): RateLimitResult {
  const bucket = getOrCreateBucket(key, capacity, refillRate);
  return consumeToken(bucket, cost);
}

/**
 * Rate limiting middleware.
 *
 * Uses the token's configured rate limits (requests_per_minute).
 * The refill rate is derived from the per-minute limit: capacity / 60 tokens per second.
 *
 * Sets standard rate limit headers on every response:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After (on 429 responses)
 */
export const rateLimitMiddleware = createMiddleware<GatewayEnv>(async (c, next) => {
  const token = c.get('token');

  if (!token) {
    // If no token is set (e.g., unauthenticated route), skip rate limiting
    await next();
    return;
  }

  const capacity = token.rate_limits.requests_per_minute;
  const refillRate = capacity / 60; // tokens per second
  const key = `rpm:${token.token_id}`;

  const result = checkRateLimit(key, capacity, refillRate);

  // Always set rate limit headers
  c.header('X-RateLimit-Limit', String(capacity));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.reset_at / 1000)));

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.retry_after_ms ?? 1000) / 1000);
    c.header('Retry-After', String(retryAfterSeconds));

    return c.json(
      {
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Try again in ${retryAfterSeconds} second(s).`,
        retry_after_ms: result.retry_after_ms,
      },
      429
    );
  }

  // Also enforce hourly limits with a separate bucket
  const hourlyCapacity = token.rate_limits.requests_per_hour;
  const hourlyRefillRate = hourlyCapacity / 3600;
  const hourlyKey = `rph:${token.token_id}`;

  const hourlyResult = checkRateLimit(hourlyKey, hourlyCapacity, hourlyRefillRate);

  if (!hourlyResult.allowed) {
    const retryAfterSeconds = Math.ceil((hourlyResult.retry_after_ms ?? 1000) / 1000);
    c.header('Retry-After', String(retryAfterSeconds));

    return c.json(
      {
        error: 'rate_limit_exceeded',
        message: `Hourly rate limit exceeded. Try again in ${retryAfterSeconds} second(s).`,
        retry_after_ms: hourlyResult.retry_after_ms,
      },
      429
    );
  }

  await next();
});
