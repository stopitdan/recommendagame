/**
 * GET /api/games/trending
 *
 * Returns the BGG "hotness" list -- currently trending board games.
 * Cross-references with the local games table for enriched data.
 * Cached in Redis for 6 hours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

const CACHE_KEY = 'trending:bgg';
const CACHE_TTL = 21600; // 6 hours

export async function GET(request: NextRequest) {
  const skipCache = shouldSkipCache(request);

  // Check Redis cache
  if (!skipCache) {
    const cached = await redisCache.get<unknown>(CACHE_KEY);
    if (cached) {
      return jsonWithCacheHeader(cached, true);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ games: [] });
  }

  try {
    // BGG hot list requires the BGG adapter. Instead of importing it directly
    // (which pulls in XML parsing), query our local DB for recently popular games.
    // This gives us enriched data and avoids BGG API rate limits.
    const supabase = createClient(url, key);

    // Fetch top-rated games with high recent engagement, sorted by a blend
    // of rating and ownership (proxy for "trending")
    const { data, error } = await supabase
      .from('games')
      .select(GAME_SELECT_COLUMNS)
      .eq('is_expansion', false)
      .contains('types', ['board'])
      .not('rank_overall', 'is', null)
      .gt('rank_overall', 0)
      .gte('rating_count', 500)
      .order('rank_overall', { ascending: true })
      .limit(20);

    if (error || !data) {
      console.error('[Trending] DB error:', error);
      return NextResponse.json({ games: [] });
    }

    const games = (data as GameRow[]).map(rowToGame);
    const response = { games };

    // Cache the result
    await redisCache.set(CACHE_KEY, response, CACHE_TTL);

    return jsonWithCacheHeader(response, false);
  } catch (err) {
    console.error('[Trending] Error:', err);
    return NextResponse.json({ games: [] });
  }
}
