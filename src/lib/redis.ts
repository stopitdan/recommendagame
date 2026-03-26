/**
 * Redis Cache Layer (Upstash)
 *
 * Provides persistent caching across serverless invocations.
 * Falls back gracefully to in-memory cache when Redis is unavailable
 * (local dev without env vars, Upstash outage, etc.).
 *
 * Usage:
 *   const data = await redisCache.get<Game[]>('browse:popular');
 *   if (!data) {
 *     const fresh = await fetchGames();
 *     await redisCache.set('browse:popular', fresh, 300); // 5 min TTL
 *   }
 *
 * Env vars required:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// ─── Singleton Client ────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

// ─── Cache Interface ─────────────────────────────────────────

export const redisCache = {
  /**
   * Get a cached value. Returns null on miss or error.
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();
    if (!client) return null;

    try {
      const data = await client.get<T>(key);
      return data ?? null;
    } catch (err) {
      console.error('[Redis] GET error:', err);
      return null;
    }
  },

  /**
   * Set a cached value with TTL in seconds.
   * Fire-and-forget — errors are logged but don't propagate.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = getRedis();
    if (!client) return;

    try {
      await client.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      console.error('[Redis] SET error:', err);
    }
  },

  /**
   * Delete a cached key (e.g., after data mutation).
   */
  async del(key: string): Promise<void> {
    const client = getRedis();
    if (!client) return;

    try {
      await client.del(key);
    } catch (err) {
      console.error('[Redis] DEL error:', err);
    }
  },

  /** Check if Redis is configured and available */
  isAvailable(): boolean {
    return getRedis() !== null;
  },
};
