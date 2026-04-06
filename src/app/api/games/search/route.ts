/**
 * GET /api/games/search
 *
 * Unified game search across all sources. Queries the local Supabase DB
 * first (fast, no rate limits), then falls back to external adapters on
 * cache miss and syncs the results for next time.
 *
 * Query params:
 *   q             — Search query (required)
 *   type          — Filter by game type: board, video, word, party, card
 *   source        — Filter by source: bgg, rawg, local
 *   minPlayers    — Minimum player count
 *   maxPlayers    — Maximum player count
 *   minComplexity — Minimum complexity (1-5)
 *   maxComplexity — Maximum complexity (1-5)
 *   popularity    — "popular" (default), "any", "hidden-gems"
 *   limit         — Max results (default: 20, max: 100)
 *
 * Example:
 *   GET /api/games/search?q=strategy&type=board&popularity=popular&limit=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Game, GameSource, GameType } from '@/types/game';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';
import { bggAdapter } from '@/lib/adapters/bgg';
import { rawgAdapter } from '@/lib/adapters/rawg';
import { localAdapter } from '@/lib/adapters/local';
import { syncSearchResults } from '@/lib/sync/game-sync';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { redisCache } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TYPES: GameType[] = ['board', 'video', 'word', 'party', 'card'];
const VALID_SOURCES: GameSource[] = ['bgg', 'rawg', 'igdb', 'local'];
type PopularityMode = 'popular' | 'any' | 'hidden-gems';
const VALID_POPULARITY: PopularityMode[] = ['popular', 'any', 'hidden-gems'];

/**
 * Minimum rating count to be considered "popular".
 * Games below this threshold are filtered out in "popular" mode.
 */
const POPULAR_MIN_RATING_COUNT = 50;

function createSearchClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const blocked = await rateLimit(request, LIMITS.medium);
  if (blocked) return blocked;

  const { searchParams } = request.nextUrl;

  // Parse query params
  const query = searchParams.get('q');
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing required parameter: q' },
      { status: 400 },
    );
  }

  const typeFilter = searchParams.get('type') as GameType | null;
  if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const sourceFilter = searchParams.get('source') as GameSource | null;
  if (sourceFilter && !VALID_SOURCES.includes(sourceFilter)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
      { status: 400 },
    );
  }

  const popularity = (searchParams.get('popularity') as PopularityMode) ?? 'popular';
  if (!VALID_POPULARITY.includes(popularity)) {
    return NextResponse.json(
      { error: `Invalid popularity. Must be one of: ${VALID_POPULARITY.join(', ')}` },
      { status: 400 },
    );
  }

  const minPlayers = parseIntParam(searchParams.get('minPlayers'));
  const maxPlayers = parseIntParam(searchParams.get('maxPlayers'));
  const minComplexity = parseFloatParam(searchParams.get('minComplexity'));
  const maxComplexity = parseFloatParam(searchParams.get('maxComplexity'));
  const limit = Math.min(parseIntParam(searchParams.get('limit')) ?? 20, 100);

  // Check Redis cache first
  const searchKey = `search:${searchParams.toString()}`;
  const cached = await redisCache.get<{ query: string; count: number; popularity: string; results: Game[] }>(searchKey);
  if (cached) return NextResponse.json(cached);

  try {
    // Step 1: Search local DB first (fast, no rate limits)
    const localResult = await searchLocalDb(query, limit * 3); // Fetch extra for post-filtering
    let results = localResult.games;

    // Step 2: If local DB has few results, fan out to external adapters
    if (results.length < limit) {
      const externalResults = await searchExternalAdapters(query, limit, sourceFilter);

      if (externalResults.length > 0) {
        syncSearchResults(externalResults).catch((err) =>
          console.error('[Search] Background sync failed:', err),
        );
      }

      const seenIds = new Set(results.map((g) => g.id));
      for (const game of externalResults) {
        if (!seenIds.has(game.id)) {
          results.push(game);
          seenIds.add(game.id);
        }
      }
    }

    // Step 3: Apply filters
    results = applyFilters(results, {
      type: typeFilter,
      source: sourceFilter,
      minPlayers,
      maxPlayers,
      minComplexity,
      maxComplexity,
      popularity,
    });

    // Step 4: Score and sort
    results = scoreAndSort(results, query, popularity);

    // Step 5: Limit
    results = results.slice(0, limit);

    const response = {
      query,
      count: results.length,
      popularity,
      results,
      // When fuzzy search kicked in, tell the client what we actually matched
      ...(localResult.fuzzy && localResult.correctedQuery && {
        fuzzyMatch: true,
        correctedQuery: localResult.correctedQuery,
      }),
    };

    // Cache for 5 minutes
    redisCache.set(searchKey, response, 300);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Local DB Search
// ---------------------------------------------------------------------------

interface LocalDbResult {
  games: Game[];
  /** True when results came from fuzzy/trigram search instead of exact tsvector match */
  fuzzy: boolean;
  /** The best-matching game name when fuzzy search kicked in (for "showing results for" hint) */
  correctedQuery?: string;
}

async function searchLocalDb(query: string, limit: number): Promise<LocalDbResult> {
  const supabase = createSearchClient();
  if (!supabase) return { games: [], fuzzy: false };

  // Try full-text search RPC first (exact lexeme matching)
  const { data: rpcResults } = await supabase
    .rpc('search_games_by_name', {
      search_query: query,
      result_limit: limit,
    });

  if (rpcResults && rpcResults.length > 0) {
    return { games: (rpcResults as GameRow[]).map(rowToGame), fuzzy: false };
  }

  // Fuzzy fallback: trigram similarity catches typos like "Bertrayal" → "Betrayal"
  const { data: fuzzyResults } = await supabase
    .rpc('fuzzy_search_games_by_name', {
      search_query: query,
      result_limit: limit,
    });

  if (fuzzyResults && fuzzyResults.length > 0) {
    const topMatch = fuzzyResults[0] as GameRow & { similarity_score: number };
    return {
      games: (fuzzyResults as GameRow[]).map(rowToGame),
      fuzzy: true,
      correctedQuery: topMatch.name,
    };
  }

  return { games: [], fuzzy: false };
}

// ---------------------------------------------------------------------------
// External Adapter Search
// ---------------------------------------------------------------------------

async function searchExternalAdapters(
  query: string,
  limit: number,
  sourceFilter: GameSource | null,
): Promise<Game[]> {
  const adapters = [
    { source: 'bgg' as const, adapter: bggAdapter },
    { source: 'rawg' as const, adapter: rawgAdapter },
    { source: 'local' as const, adapter: localAdapter },
  ];

  const selected = sourceFilter
    ? adapters.filter((a) => a.source === sourceFilter)
    : adapters;

  const searchPromises = selected.map(async ({ adapter }) => {
    try {
      return await adapter.search(query, { limit });
    } catch (error) {
      console.error(`[Search] ${adapter.source} adapter failed:`, error);
      return [] as Game[];
    }
  });

  const resultSets = await Promise.all(searchPromises);
  return resultSets.flat();
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

interface FilterOptions {
  type: GameType | null;
  source: GameSource | null;
  minPlayers: number | undefined;
  maxPlayers: number | undefined;
  minComplexity: number | undefined;
  maxComplexity: number | undefined;
  popularity: PopularityMode;
}

function applyFilters(games: Game[], filters: FilterOptions): Game[] {
  return games.filter((game) => {
    if (filters.type && !game.types.includes(filters.type)) return false;
    if (filters.source && game.source !== filters.source) return false;

    if (filters.minPlayers && game.playerCount) {
      if (game.playerCount.max < filters.minPlayers) return false;
    }
    if (filters.maxPlayers && game.playerCount) {
      if (game.playerCount.min > filters.maxPlayers) return false;
    }

    if (filters.minComplexity && game.complexity != null) {
      if (game.complexity < filters.minComplexity) return false;
    }
    if (filters.maxComplexity && game.complexity != null) {
      if (game.complexity > filters.maxComplexity) return false;
    }

    // Popularity filter
    if (filters.popularity === 'popular') {
      // Must have a meaningful number of ratings to be considered
      if ((game.ratingCount ?? 0) < POPULAR_MIN_RATING_COUNT) return false;
    } else if (filters.popularity === 'hidden-gems') {
      // Hidden gems: fewer ratings but still decent quality
      if ((game.ratingCount ?? 0) >= POPULAR_MIN_RATING_COUNT * 10) return false;
      if ((game.rating ?? 0) < 6.0) return false;
    }
    // 'any' = no popularity filtering

    return true;
  });
}

// ---------------------------------------------------------------------------
// Scoring & Sorting
// ---------------------------------------------------------------------------

/**
 * Scores and sorts games by a composite relevance score.
 *
 * Score components:
 * - Name match quality (exact > starts-with > contains)
 * - Rating quality (higher rating = higher score)
 * - Popularity signal (more ratings = more trusted)
 *
 * In "popular" mode, popularity gets extra weight.
 * In "hidden-gems" mode, rating quality gets extra weight.
 */
function scoreAndSort(games: Game[], query: string, popularity: PopularityMode): Game[] {
  const lowerQuery = query.toLowerCase();

  const scored = games.map((game) => {
    let score = 0;

    // Name match quality (0-30 points)
    const lowerName = game.name.toLowerCase();
    if (lowerName === lowerQuery) {
      score += 30; // Exact match
    } else if (lowerName.startsWith(lowerQuery)) {
      score += 20; // Starts with
    } else if (lowerName.includes(lowerQuery)) {
      score += 10; // Contains
    }

    // Rating quality (0-20 points)
    const rating = game.rating ?? 0;
    score += (rating / 10) * 20;

    // Popularity signal (0-30 points, log scale)
    const ratingCount = game.ratingCount ?? 0;
    const popularityScore = ratingCount > 0
      ? Math.min(Math.log10(ratingCount) / 5, 1) * 30 // log10(100000)/5 = 1.0
      : 0;

    if (popularity === 'popular') {
      score += popularityScore * 1.5; // Boost popularity weight
    } else if (popularity === 'hidden-gems') {
      score += popularityScore * 0.3; // Reduce popularity weight
      score += (rating / 10) * 10;    // Extra rating weight
    } else {
      score += popularityScore;
    }

    return { game, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.game);
}

// ---------------------------------------------------------------------------
// Param Parsing
// ---------------------------------------------------------------------------

function parseIntParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseFloatParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}
