/**
 * GET /api/leaderboard — Top games by favorites count + rating
 *
 * Query params:
 *   type   — Filter by game type (board, video, word)
 *   limit  — Max results (default: 25, max: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { leaderboardCache } from '@/lib/cache';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 100);

  // Check cache first (5 min TTL)
  const skipCache = shouldSkipCache(request);
  const cacheKey = `leaderboard:${type ?? 'all'}:${limit}`;
  if (!skipCache) {
    const cached = leaderboardCache.get(cacheKey);
    if (cached) {
      return jsonWithCacheHeader(cached, true);
    }
  }

  const supabase = createDbClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Rank by a composite of rating + rating_count (popularity-weighted quality)
  let query = supabase
    .from('games')
    .select('*')
    .not('rating', 'is', null)
    .gt('rating_count', 100)
    .order('rating', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.contains('types', [type]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = { games: data ?? [], type: type ?? 'all' };
  leaderboardCache.set(cacheKey, response);

  return NextResponse.json(response);
}
