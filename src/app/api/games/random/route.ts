/**
 * GET /api/games/random
 *
 * Returns a random game. Fetches top 100 by popularity and picks one.
 * No offsets, no ranges, no complex queries — just limit(100) + random pick.
 *
 * Query params:
 *   type — Filter by game type (board, video, word, party)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COLUMNS = 'id,source,source_id,name,description,year_published,types,min_players,max_players,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url';

let cachedGames: Record<string, unknown[]> = {};
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'all';
  const cacheKey = type;

  // Return from cache if fresh
  if (cachedGames[cacheKey] && Date.now() - cacheTime < CACHE_TTL) {
    const games = cachedGames[cacheKey];
    return NextResponse.json({ game: games[Math.floor(Math.random() * games.length)] });
  }

  try {
    // Use gt filter to hit the rating index directly — much faster than
    // ordering the full table. rating >= 7.0 is a small subset.
    let query = supabase
      .from('games')
      .select(COLUMNS)
      .gte('rating', 6.5)
      .limit(200);

    if (type !== 'all') {
      query = query.contains('types', [type]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Random]', error.message);
      // Try to serve from stale cache
      if (cachedGames[cacheKey]?.length) {
        const games = cachedGames[cacheKey];
        return NextResponse.json({ game: games[Math.floor(Math.random() * games.length)] });
      }
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No games found' }, { status: 404 });
    }

    // Cache the results
    cachedGames[cacheKey] = data;
    cacheTime = Date.now();

    return NextResponse.json({ game: data[Math.floor(Math.random() * data.length)] });
  } catch (err) {
    console.error('[Random] Exception:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
