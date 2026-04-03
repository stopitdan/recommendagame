/**
 * Flush all recommendation caches from Redis.
 * Run: npx tsx scripts/bust-redis-cache.ts
 *
 * Clears all rec:* keys (recommendation results cache).
 * In-memory caches clear automatically on dev server restart.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env.local');
    process.exit(1);
  }

  const redis = new Redis({ url, token });

  // Scan for all rec:* keys and delete them
  let cursor = 0;
  let totalDeleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: 'rec:*', count: 100 });
    cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      totalDeleted += keys.length;
    }
  } while (cursor !== 0);

  console.log(`Redis cache busted: ${totalDeleted} rec:* keys deleted.`);
  console.log('Restart dev server to also clear in-memory cache.');
}

main().catch(console.error);
