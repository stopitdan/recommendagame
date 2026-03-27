/**
 * Pre-computed Popularity Lists
 *
 * Cached popular game lists stored in Redis for instant fallback.
 * These are computed by a batch job and serve as the safety net
 * that guarantees we ALWAYS have results to show.
 *
 * Lists are pre-computed for:
 *   - Top games overall
 *   - Top games per type (board, video, word, party)
 *   - Top games per player count bracket (1, 2, 3-4, 5-6, 7+)
 *   - Top games per popular category
 *
 * Used as the final fallback in the recommend pipeline when all
 * other candidate sources return empty.
 */

import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import type { Game } from '@/types/game';

// ─── Config ──────────────────────────────────────────────────

const REDIS_PREFIX = 'pop';
const TTL_SECONDS = 86400; // 24 hours

const GAME_COLUMNS = 'id,source,source_id,name,description,year_published,types,min_players,max_players,recommended_players,min_play_time,max_play_time,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url';

const POPULAR_CATEGORIES = [
  'Strategy', 'Family', 'Party', 'Cooperative', 'RPG', 'Adventure',
  'Puzzle', 'Action', 'Horror', 'Sci-Fi', 'Fantasy', 'Word Game',
  'Card Game', 'War', 'Abstract', 'Economic', 'Trivia', 'Dice',
  'Racing', 'Sports', 'Simulation', 'Shooter', 'Fighting',
  'Platformer', 'Open World', 'Survival', 'Indie',
];

// ─── Compute + Cache ─────────────────────────────────────────

/**
 * Computes popular game lists and caches them in Redis.
 * Call this from a cron job or manually via the populate script.
 */
export async function computeAndCachePopularLists(): Promise<{
  totalLists: number;
  totalGames: number;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { totalLists: 0, totalGames: 0 };

  const supabase = createClient(url, key);
  let totalLists = 0;
  let totalGames = 0;

  // Helper to fetch + cache a list (with error handling for timeouts)
  async function cacheList(cacheKey: string, query: any, limit: number = 30) {
    try {
      const { data, error } = await query.limit(limit);
      if (error) {
        console.log(`  [skip] ${cacheKey}: ${error.message}`);
        return;
      }
      if (data && data.length > 0) {
        const games = (data as GameRow[]).map(rowToGame);
        await redisCache.set(`${REDIS_PREFIX}:${cacheKey}`, games, TTL_SECONDS);
        totalLists++;
        totalGames += games.length;
        console.log(`  [cached] ${cacheKey}: ${games.length} games`);
      } else {
        console.log(`  [empty] ${cacheKey}`);
      }
    } catch (err) {
      console.log(`  [error] ${cacheKey}: ${err}`);
    }
  }

  // Top overall — order by most-reviewed (fast, uses index)
  await cacheList('overall', supabase
    .from('games').select(GAME_COLUMNS)
    .gte('rating_count', 10)
    .order('rating_count', { ascending: false }), 100);

  // Top per type
  for (const type of ['board', 'video', 'word', 'party']) {
    await cacheList(`type:${type}`, supabase
      .from('games').select(GAME_COLUMNS)
      .contains('types', [type])
      .gte('rating_count', 5)
      .order('rating_count', { ascending: false }), 50);
  }

  // Top per player count bracket
  const playerBrackets = [
    { key: '1', min: 1, max: 1 },
    { key: '2', min: 2, max: 2 },
    { key: '3-4', min: 3, max: 4 },
    { key: '5-6', min: 5, max: 6 },
    { key: '7+', min: 7, max: 99 },
  ];

  for (const { key: bracketKey, min, max } of playerBrackets) {
    await cacheList(`players:${bracketKey}`, supabase
      .from('games').select(GAME_COLUMNS)
      .lte('min_players', max).gte('max_players', min)
      .gte('rating_count', 3)
      .order('rating_count', { ascending: false }), 50);
  }

  // Top per popular category
  for (const category of POPULAR_CATEGORIES) {
    await cacheList(`cat:${category}`, supabase
      .from('games').select(GAME_COLUMNS)
      .contains('categories', [category])
      .gte('rating_count', 3)
      .order('rating_count', { ascending: false }), 30);
  }

  // Top per popular mechanic
  const POPULAR_MECHANICS = [
    'Deck Building', 'Worker Placement', 'Area Control', 'Dice Rolling',
    'Hand Management', 'Set Collection', 'Cooperative', 'Social Deduction',
    'Engine Building', 'Tile Placement',
  ];
  for (const mechanic of POPULAR_MECHANICS) {
    await cacheList(`mech:${mechanic}`, supabase
      .from('games').select(GAME_COLUMNS)
      .contains('mechanics', [mechanic])
      .gte('rating_count', 3)
      .order('rating_count', { ascending: false }), 30);
  }

  return { totalLists, totalGames };
}

// ─── Fallback Retrieval ──────────────────────────────────────

/**
 * Gets the most relevant pre-computed popular list for the user's preferences.
 * Returns games from Redis cache — extremely fast, no DB query needed.
 *
 * Selection logic:
 *   1. If user specified a player count → use player bracket list
 *   2. If user specified a game type → use type list
 *   3. If user specified genres → use category list for first matching genre
 *   4. Else → use overall top games
 */
export async function getPopularFallback(prefs: {
  playerCount?: { min: number; max: number };
  gameTypes?: string[];
  genres?: string[];
}): Promise<Game[]> {
  // Try player count bracket first (most specific)
  if (prefs.playerCount) {
    const mid = Math.round((prefs.playerCount.min + prefs.playerCount.max) / 2);
    let bracketKey: string;
    if (mid <= 1) bracketKey = '1';
    else if (mid <= 2) bracketKey = '2';
    else if (mid <= 4) bracketKey = '3-4';
    else if (mid <= 6) bracketKey = '5-6';
    else bracketKey = '7+';

    const cached = await redisCache.get<Game[]>(`${REDIS_PREFIX}:players:${bracketKey}`);
    if (cached && cached.length > 0) return cached;
  }

  // Try game type
  if (prefs.gameTypes && prefs.gameTypes.length > 0) {
    const cached = await redisCache.get<Game[]>(`${REDIS_PREFIX}:type:${prefs.gameTypes[0]}`);
    if (cached && cached.length > 0) return cached;
  }

  // Try category
  if (prefs.genres && prefs.genres.length > 0) {
    for (const genre of prefs.genres) {
      if (POPULAR_CATEGORIES.includes(genre)) {
        const cached = await redisCache.get<Game[]>(`${REDIS_PREFIX}:cat:${genre}`);
        if (cached && cached.length > 0) return cached;
      }
    }
  }

  // Overall fallback
  const cached = await redisCache.get<Game[]>(`${REDIS_PREFIX}:overall`);
  return cached ?? [];
}
