/**
 * GET /api/games/random
 *
 * Returns a random game from the database. Useful for "I'm feeling lucky"
 * or discovery features.
 *
 * Query params:
 *   type — Filter by game type (board, video, word, party)
 *   minRating — Minimum rating (default: 6.0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // Get a count of eligible games
  let countQuery = supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null)
    .gte('rating', minRating)
    .gte('rating_count', 50);

  if (type) {
    countQuery = countQuery.contains('types', [type]);
  }

  const { count, error: countError } = await countQuery;

  if (countError || !count || count === 0) {
    return NextResponse.json({ error: 'No games found' }, { status: 404 });
  }

  // Pick a random offset
  const randomOffset = Math.floor(Math.random() * count);

  let query = supabase
    .from('games')
    .select('*')
    .not('rating', 'is', null)
    .gte('rating', minRating)
    .gte('rating_count', 50)
    .range(randomOffset, randomOffset);

  if (type) {
    query = query.contains('types', [type]);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'Could not fetch random game' }, { status: 500 });
  }

  return NextResponse.json({ game: data[0] });
}
