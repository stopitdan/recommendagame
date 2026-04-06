/**
 * GET /api/games/browse — Browse games with server-side filtering
 *
 * Unlike /search (which requires a text query), /browse supports pure
 * filter-based browsing — great for "show me all Strategy games" etc.
 *
 * Query params:
 *   category   — Filter by category (e.g. "Strategy")
 *   mechanic   — Filter by mechanic (e.g. "Deck Building")
 *   theme      — Filter by theme (e.g. "Fantasy")
 *   platform   — Filter by platform (e.g. "PC")
 *   type       — Filter by game type (board, video, word)
 *   q          — Optional text search within filtered results
 *   popularity — "popular" (default), "any", "hidden-gems"
 *   sort       — "rating" (default), "name", "year", "popularity"
 *   limit      — Max results (default: 40, max: 100)
 *   offset     — Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';
import { redisCache } from '@/lib/redis';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const blocked = await rateLimit(request, LIMITS.medium);
  if (blocked) return blocked;

  const { searchParams } = request.nextUrl;
  const supabase = createDbClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const category = searchParams.get('category');
  const mechanic = searchParams.get('mechanic');
  const theme = searchParams.get('theme');
  const platform = searchParams.get('platform');
  const designer = searchParams.get('designer');
  const publisher = searchParams.get('publisher');
  const type = searchParams.get('type');
  const textQuery = searchParams.get('q');
  const popularity = searchParams.get('popularity') ?? 'popular';
  const sort = searchParams.get('sort') ?? 'rating';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '40', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  // Numeric range filters
  const minPlayers = searchParams.get('minPlayers');
  const maxPlayers = searchParams.get('maxPlayers');
  const minTime = searchParams.get('minTime');
  const maxTime = searchParams.get('maxTime');
  const minComplexity = searchParams.get('minComplexity');
  const maxComplexity = searchParams.get('maxComplexity');
  const minRating = searchParams.get('minRating');
  const yearFrom = searchParams.get('yearFrom');
  const yearTo = searchParams.get('yearTo');

  // Check Redis cache (browse results change slowly — 5 min TTL)
  const browseKey = `browse:${searchParams.toString()}`;
  const cached = await redisCache.get<unknown>(browseKey);
  if (cached) return NextResponse.json(cached);

  const selectColumns = 'id,source,source_id,name,description,year_published,types,min_players,max_players,recommended_players,min_play_time,max_play_time,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url';

  let query = supabase.from('games').select(
    selectColumns,
    { count: 'estimated' },
  );

  // Exclude expansions — they clutter results and bloat scans
  query = query.eq('is_expansion', false);

  // Array containment filters
  if (category) query = query.contains('categories', [category]);
  if (mechanic) query = query.contains('mechanics', [mechanic]);
  if (theme) query = query.contains('themes', [theme]);
  if (platform) query = query.contains('platforms', [platform]);
  if (designer) query = query.contains('designers', [designer]);
  if (publisher) query = query.contains('publishers', [publisher]);
  if (type) query = query.contains('types', [type]);

  // Player count range
  if (minPlayers) query = query.gte('max_players', parseInt(minPlayers, 10));
  if (maxPlayers) query = query.lte('min_players', parseInt(maxPlayers, 10));

  // Play time range (minutes)
  if (minTime) query = query.gte('avg_play_time', parseInt(minTime, 10));
  if (maxTime) query = query.lte('avg_play_time', parseInt(maxTime, 10));

  // Complexity range (1-5)
  if (minComplexity) query = query.gte('complexity', parseFloat(minComplexity));
  if (maxComplexity) query = query.lte('complexity', parseFloat(maxComplexity));

  // Minimum rating
  if (minRating) query = query.gte('rating', parseFloat(minRating));

  // Year range
  if (yearFrom) query = query.gte('year_published', parseInt(yearFrom, 10));
  if (yearTo) query = query.lte('year_published', parseInt(yearTo, 10));

  // Text search — two-step approach: get matching IDs via GIN-indexed RPC first,
  // then filter by ID. This prevents Postgres from combining GIN text search
  // with GIN array containment + ORDER BY in one poorly-optimized plan.
  let fuzzyMatch = false;
  let correctedQuery: string | undefined;
  if (textQuery) {
    const trimmed = textQuery.trim();
    const { data: nameMatches } = await supabase
      .rpc('search_games_by_name', { search_query: trimmed, result_limit: 200 });
    let matchedIds = (nameMatches ?? []).map((g: { id: string }) => g.id);

    // Fuzzy fallback: if exact tsvector found nothing, try trigram similarity
    if (matchedIds.length === 0) {
      const { data: fuzzyMatches } = await supabase
        .rpc('fuzzy_search_games_by_name', { search_query: trimmed, result_limit: 200 });
      matchedIds = (fuzzyMatches ?? []).map((g: { id: string }) => g.id);
      if (matchedIds.length > 0) {
        fuzzyMatch = true;
        correctedQuery = (fuzzyMatches![0] as { name: string }).name;
      }
    }

    if (matchedIds.length === 0) {
      const emptyResponse = { games: [], total: 0, limit, offset, filters: { category, mechanic, theme, platform, type, q: textQuery, popularity, sort } };
      redisCache.set(browseKey, emptyResponse, 900);
      return NextResponse.json(emptyResponse);
    }
    query = query.in('id', matchedIds);
  }

  // Popularity filter
  if (popularity === 'popular') {
    query = query.gt('rating_count', 50);
  } else if (popularity === 'hidden-gems') {
    query = query.lt('rating_count', 500).gt('rating', 6);
  }

  // Sorting
  switch (sort) {
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    case 'year':
      query = query.order('year_published', { ascending: false, nullsFirst: false });
      break;
    case 'popularity':
      query = query.order('rating_count', { ascending: false, nullsFirst: false });
      break;
    case 'rating':
    default:
      query = query.order('rating', { ascending: false, nullsFirst: false });
      break;
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = {
    games: ((data ?? []) as GameRow[]).map(rowToGame),
    total: count ?? 0,
    limit,
    offset,
    filters: { category, mechanic, theme, platform, type, q: textQuery, popularity, sort },
    ...(fuzzyMatch && correctedQuery && { fuzzyMatch: true, correctedQuery }),
  };

  // Cache for 5 minutes (browse data changes slowly)
  redisCache.set(browseKey, response, 900); // 15 min — browse data changes slowly

  return NextResponse.json(response);
}
