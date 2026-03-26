/**
 * GET /api/games/random
 *
 * Returns a random game. Uses a two-step approach:
 * 1. Fetch a small random page of quality games
 * 2. Pick one randomly from that page
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

  // Strategy: pick a random page from the top-rated games.
  // PAGE_SIZE games per page, random page number from 0 to MAX_PAGES.
  // If the random page overshoots, we fall back to page 0.
  const PAGE_SIZE = 50;
  const MAX_PAGES = 30; // 30 pages × 50 = top 1500 games — plenty of variety
  const randomPage = Math.floor(Math.random() * MAX_PAGES);

  for (let attempt = 0; attempt < 3; attempt++) {
    const page = attempt === 0 ? randomPage : 0; // Fall back to first page on retry
    const offset = page * PAGE_SIZE;

    try {
      let query = supabase
        .from('games')
        .select(GAME_COLUMNS)
        .not('rating', 'is', null)
        .gte('rating', attempt > 0 ? 4.0 : minRating) // Loosen on retry
        .gte('rating_count', attempt > 0 ? 5 : 20)     // Loosen on retry
        .order('rating', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (type) {
        query = query.contains('types', [type]);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`[Random] Attempt ${attempt + 1} error:`, error.message);
        continue; // Retry
      }

      if (data && data.length > 0) {
        const pick = data[Math.floor(Math.random() * data.length)];
        return NextResponse.json({ game: pick });
      }

      // Empty results — retry with page 0
    } catch (err) {
      console.error(`[Random] Attempt ${attempt + 1} exception:`, err);
    }
  }

  // All retries exhausted — try absolute minimum filters
  try {
    let query = supabase
      .from('games')
      .select(GAME_COLUMNS)
      .not('rating', 'is', null)
      .order('rating_count', { ascending: false })
      .limit(PAGE_SIZE);

    if (type) {
      query = query.contains('types', [type]);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const pick = data[Math.floor(Math.random() * data.length)];
      return NextResponse.json({ game: pick });
    }
  } catch {
    // Final fallback failed
  }

  return NextResponse.json({ error: 'No games found' }, { status: 404 });
}
