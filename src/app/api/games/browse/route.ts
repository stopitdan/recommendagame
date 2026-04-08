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
  const sort = searchParams.get('sort') ?? 'popularity';
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

  /** Build a fresh query with all active filters applied. */
  function buildQuery() {
    let q = supabase!.from('games').select(selectColumns, { count: 'estimated' });

    q = q.eq('is_expansion', false);

    if (category) q = q.contains('categories', [category]);
    if (mechanic) q = q.contains('mechanics', [mechanic]);
    if (theme) q = q.contains('themes', [theme]);
    if (platform) q = q.contains('platforms', [platform]);
    if (designer) q = q.contains('designers', [designer]);
    if (publisher) q = q.contains('publishers', [publisher]);
    if (type) q = q.contains('types', [type]);

    if (minPlayers) q = q.gte('max_players', parseInt(minPlayers, 10));
    if (maxPlayers) q = q.lte('min_players', parseInt(maxPlayers, 10));
    if (minTime) q = q.gte('avg_play_time', parseInt(minTime, 10));
    if (maxTime) q = q.lte('avg_play_time', parseInt(maxTime, 10));
    if (minComplexity) q = q.gte('complexity', parseFloat(minComplexity));
    if (maxComplexity) q = q.lte('complexity', parseFloat(maxComplexity));
    if (minRating) q = q.gte('rating', parseFloat(minRating));
    if (yearFrom) q = q.gte('year_published', parseInt(yearFrom, 10));
    if (yearTo) q = q.lte('year_published', parseInt(yearTo, 10));

    if (popularity === 'popular') q = q.gt('rating_count', 50);
    else if (popularity === 'hidden-gems') q = q.lt('rating_count', 500).gt('rating', 6);

    return q;
  }

  function applySort(q: ReturnType<typeof buildQuery>) {
    switch (sort) {
      case 'name': return q.order('name', { ascending: true });
      case 'year': return q.order('year_published', { ascending: false, nullsFirst: false });
      case 'rating': return q.order('rating', { ascending: false, nullsFirst: false });
      case 'popularity':
      default: return q.order('rating_count', { ascending: false, nullsFirst: false });
    }
  }

  // Text search — two-step approach: get matching IDs via GIN-indexed RPC first,
  // then filter by ID. This prevents Postgres from combining GIN text search
  // with GIN array containment + ORDER BY in one poorly-optimized plan.
  let fuzzyMatch = false;
  let correctedQuery: string | undefined;
  let textMatchedIds: string[] | null = null;
  if (textQuery) {
    const trimmed = textQuery.trim();
    const { data: nameMatches } = await supabase
      .rpc('search_games_by_name', { search_query: trimmed, result_limit: 200 });
    let matchedIds = (nameMatches ?? []).map((g: { id: string }) => g.id);

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
    textMatchedIds = matchedIds;
  }

  // ── Type-diverse interleaving ────────────────────────────────
  // When no type filter is active and there's no text search, fetch
  // top games per type separately and interleave for a balanced mix.
  const shouldInterleave = !type && !textQuery;

  if (shouldInterleave) {
    const gameTypes = ['board', 'video', 'word', 'party'];
    const perType = Math.ceil(limit / gameTypes.length) + 4;

    const bucketResults = await Promise.all(
      gameTypes.map((t) => {
        let q = buildQuery();
        q = q.contains('types', [t]);
        q = applySort(q);
        return q.range(0, perType - 1).then(({ data: d }) => ({
          type: t,
          games: (d ?? []) as GameRow[],
        }));
      }),
    );

    // Round-robin interleave: take one from each type in rotation,
    // skipping duplicates (a game with types ['board','party'] appears in both buckets).
    const interleaved: GameRow[] = [];
    const seen = new Set<string>();
    const cursors = Object.fromEntries(gameTypes.map((t) => [t, 0]));
    const bucketMap = Object.fromEntries(bucketResults.map((b) => [b.type, b.games]));

    while (interleaved.length < offset + limit) {
      let added = false;
      for (const t of gameTypes) {
        const bucket = bucketMap[t];
        while (cursors[t] < bucket.length) {
          const row = bucket[cursors[t]];
          cursors[t]++;
          if (!seen.has(row.id)) {
            seen.add(row.id);
            interleaved.push(row);
            added = true;
            break;
          }
        }
      }
      if (!added) break;
    }

    const paged = interleaved.slice(offset, offset + limit);
    const totalEstimate = bucketResults.reduce((sum, b) => sum + b.games.length, 0);

    const response = {
      games: paged.map(rowToGame),
      total: totalEstimate,
      limit,
      offset,
      filters: { category, mechanic, theme, platform, type, q: textQuery, popularity, sort },
    };

    redisCache.set(browseKey, response, 900);
    return NextResponse.json(response);
  }

  // ── Standard single-query path (type filter active or text search) ──
  let query = buildQuery();
  if (textMatchedIds) query = query.in('id', textMatchedIds);
  query = applySort(query);
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

  redisCache.set(browseKey, response, 900);

  return NextResponse.json(response);
}
