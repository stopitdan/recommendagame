/**
 * GET /api/daily-pick — Returns a featured game of the day
 *
 * Picks a deterministic high-quality game based on the current date.
 * Uses a hash of the date string to select from top-rated games,
 * ensuring the same game shows all day but changes at midnight UTC.
 *
 * Cached in Redis for 1 hour to avoid repeated DB hits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Simple hash of a string to a number */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function GET(request: NextRequest) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  const cacheKey = `daily-pick:${today}`;
  const skipCache = shouldSkipCache(request);

  // Check cache
  if (!skipCache) {
    const cached = await redisCache.get<ReturnType<typeof rowToGame>>(cacheKey);
    if (cached) return jsonWithCacheHeader({ game: cached, date: today }, true);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  // Fetch top 200 games by rating (with sufficient votes and not expansions)
  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .gte('rating', 7.0)
    .gte('rating_count', 500)
    .eq('is_expansion', false)
    .not('image_url', 'is', null)
    .order('rating', { ascending: false })
    .limit(200);

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No games found' }, { status: 500 });
  }

  // Pick one deterministically based on today's date
  const index = hashString(today) % data.length;
  const game = rowToGame(data[index] as GameRow);

  // Cache for 1 hour
  redisCache.set(cacheKey, game, 3600);

  return jsonWithCacheHeader({ game, date: today }, false);
}
