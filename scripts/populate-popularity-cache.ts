/**
 * Populates the Redis popularity cache with pre-computed game lists.
 *
 * Usage:
 *   npx tsx scripts/populate-popularity-cache.ts
 *
 * Run daily (or whenever game data changes significantly).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { computeAndCachePopularLists } from '../src/lib/recommendation/popularity-cache';

async function main() {
  console.log('[Popularity Cache] Starting...');
  const result = await computeAndCachePopularLists();
  console.log(`[Popularity Cache] Done! ${result.totalLists} lists, ${result.totalGames} total games cached.`);
}

main().catch(console.error);
