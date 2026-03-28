/**
 * Rate Limiting (Upstash)
 *
 * Provides per-IP rate limiting using Upstash Redis.
 * Falls back to allowing all requests when Redis is unavailable.
 *
 * Usage in API routes:
 *   import { rateLimit, LIMITS } from '@/lib/rate-limit';
 *
 *   export async function POST(request: NextRequest) {
 *     const blocked = await rateLimit(request, LIMITS.expensive);
 *     if (blocked) return blocked;
 *     // ... handle request
 *   }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// ─── Rate Limiter Instances ─────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Pre-configured rate limit tiers.
 * Each creates a Ratelimit instance lazily on first use.
 */
export const LIMITS = {
  /** Expensive endpoints: recommend, parse-text — costs real money (OpenAI, heavy DB) */
  expensive: { tokens: 30, window: '60s' as const, prefix: 'rl:expensive' },
  /** Medium endpoints: browse, search — DB-heavy but cached */
  medium: { tokens: 60, window: '60s' as const, prefix: 'rl:medium' },
  /** Light endpoints: CRUD operations */
  light: { tokens: 120, window: '60s' as const, prefix: 'rl:light' },
} as const;

type LimitConfig = (typeof LIMITS)[keyof typeof LIMITS];

const limiters = new Map<string, Ratelimit>();

function getLimiter(config: LimitConfig): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;

  let limiter = limiters.get(config.prefix);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(config.tokens, config.window),
      prefix: config.prefix,
    });
    limiters.set(config.prefix, limiter);
  }
  return limiter;
}

/**
 * Check rate limit for the given request.
 * Returns a 429 NextResponse if blocked, or null if allowed.
 */
export async function rateLimit(
  request: NextRequest,
  config: LimitConfig,
): Promise<NextResponse | null> {
  const limiter = getLimiter(config);
  if (!limiter) return null; // Redis unavailable — allow request

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  try {
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        },
      );
    }
  } catch (err) {
    // Rate limit check failed — allow the request rather than blocking
    console.error('[RateLimit] Error:', err);
  }

  return null;
}
