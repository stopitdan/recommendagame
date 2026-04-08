/**
 * GET /api/games/[id] — Fetch a single game by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createDbClient();
  const skipCache = shouldSkipCache(request);

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Check Redis (game data rarely changes -- 10 min TTL)
  const cacheKey = `game:${id}`;
  if (!skipCache) {
    const cached = await redisCache.get<unknown>(cacheKey);
    if (cached) return jsonWithCacheHeader(cached, true);
  }

  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const response = { game: rowToGame(data as GameRow) };
  redisCache.set(cacheKey, response, 600); // 10 min TTL

  return jsonWithCacheHeader(response, false);
}
