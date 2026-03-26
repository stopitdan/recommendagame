/**
 * GET /api/games/random
 *
 * Returns a random game from the database. Uses a random offset
 * with a bounded range instead of counting all rows (which times out).
 *
 * Query params:
 *   type — Filter by game type (board, video, word, party)
 *   minRating — Minimum rating (default: 6.0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GAME_COLUMNS = 'id,source,source_id,name,description,year_published,types,min_players,max_players,recommended_players,min_play_time,max_play_time,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url';

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

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const minRating = parseFloat(searchParams.get('minRating') ?? '6.0');

  // Fetch a batch of random candidates and pick one.
  // This avoids the expensive COUNT query that times out on large tables.
  // We grab 50 games at a random offset and pick one from the batch.
  const MAX_OFFSET = 5000; // Don't go too high — most quality games are in the first few thousand by rating
  const randomOffset = Math.floor(Math.random() * MAX_OFFSET);

  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null)
    .gte('rating', minRating)
    .gte('rating_count', 20)
    .order('rating', { ascending: false })
    .range(randomOffset, randomOffset + 49);

  if (type) {
    query = query.contains('types', [type]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!data || data.length === 0) {
    // Fallback: try from the start (offset was too high for this filter)
    let fallback = supabase
      .from('games')
      .select(GAME_COLUMNS)
      .not('rating', 'is', null)
      .gte('rating', minRating)
      .gte('rating_count', 10)
      .order('rating', { ascending: false })
      .limit(50);

    if (type) {
      fallback = fallback.contains('types', [type]);
    }

    const { data: fallbackData } = await fallback;
    if (!fallbackData || fallbackData.length === 0) {
      return NextResponse.json({ error: 'No games found' }, { status: 404 });
    }

    const pick = fallbackData[Math.floor(Math.random() * fallbackData.length)];
    return NextResponse.json({ game: pick });
  }

  // Pick a random game from the batch
  const pick = data[Math.floor(Math.random() * data.length)];
  return NextResponse.json({ game: pick });
}
