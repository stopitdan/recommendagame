/**
 * GET /api/games/search
 *
 * Unified game search across all sources. Queries the local Supabase DB
 * first (fast, no rate limits), then falls back to external adapters on
 * cache miss and syncs the results for next time.
 *
 * Query params:
 *   q         — Search query (required)
 *   type      — Filter by game type: board, video, word, party, card
 *   source    — Filter by source: bgg, rawg, local
 *   minPlayers — Minimum player count
 *   maxPlayers — Maximum player count
 *   minComplexity — Minimum complexity (1-5)
 *   maxComplexity — Maximum complexity (1-5)
 *   limit     — Max results (default: 20, max: 100)
 *
 * Example:
 *   GET /api/games/search?q=catan&type=board&limit=10
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TYPES: GameType[] = ['board', 'video', 'word', 'party', 'card'];
const VALID_SOURCES: GameSource[] = ['bgg', 'rawg', 'igdb', 'local'];

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

  const minPlayers = parseIntParam(searchParams.get('minPlayers'));
  const maxPlayers = parseIntParam(searchParams.get('maxPlayers'));
  const minComplexity = parseFloatParam(searchParams.get('minComplexity'));
  const maxComplexity = parseFloatParam(searchParams.get('maxComplexity'));
  const limit = Math.min(parseIntParam(searchParams.get('limit')) ?? 20, 100);

  try {
    // Step 1: Search local DB first (fast, no rate limits)
    let results = await searchLocalDb(query, limit * 2); // Fetch extra for post-filtering

    // Step 2: If local DB has few results, fan out to external adapters
    if (results.length < limit) {
      const externalResults = await searchExternalAdapters(query, limit, sourceFilter);

      // Sync external results to DB for next time (fire and forget)
      if (externalResults.length > 0) {
        syncSearchResults(externalResults).catch((err) =>
          console.error('[Search] Background sync failed:', err),
        );
      }

      // Merge, dedup by ID
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
    });

    // Step 4: Sort by relevance (rating as a proxy, with name match boost)
    results = sortByRelevance(results, query);

    // Step 5: Limit
    results = results.slice(0, limit);

    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
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

async function searchLocalDb(query: string, limit: number): Promise<Game[]> {
  const supabase = createSearchClient();
  if (!supabase) return [];

  // Try full-text search RPC first
  const { data: rpcResults } = await supabase
    .rpc('search_games_by_name', {
      search_query: query,
      result_limit: limit,
    });

  if (rpcResults && rpcResults.length > 0) {
    return (rpcResults as GameRow[]).map(rowToGame);
  }

  // Fallback: ILIKE search for partial matches
  const { data: ilikeResults } = await supabase
    .from('games')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (ilikeResults && ilikeResults.length > 0) {
    return (ilikeResults as GameRow[]).map(rowToGame);
  }

  return [];
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

  // Filter to specific source if requested
  const selected = sourceFilter
    ? adapters.filter((a) => a.source === sourceFilter)
    : adapters;

  // Fan out searches in parallel
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

    return true;
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function sortByRelevance(games: Game[], query: string): Game[] {
  const lowerQuery = query.toLowerCase();

  return [...games].sort((a, b) => {
    // Exact name match gets highest priority
    const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0;
    const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // Name starts with query gets second priority
    const aStarts = a.name.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
    const bStarts = b.name.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
    if (aStarts !== bStarts) return bStarts - aStarts;

    // Then sort by rating (higher is better)
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
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
