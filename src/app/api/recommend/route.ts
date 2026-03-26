/**
 * POST /api/recommend
 *
 * The main recommendation endpoint. Combines multiple layers:
 *
 *   Layer 1: Hybrid candidate fetching — 250 by pgvector similarity +
 *            250 by rating + text search, deduplicated
 *   Layer 2: Rule-based scoring — scores games on 9 weighted dimensions
 *   Layer 3: In-memory similarity re-ranking on top candidates
 *
 * The key innovation is hybrid candidate fetching: pgvector finds niche
 * games that match user preferences (e.g., actual roguelike deck builders),
 * while rating-based fetching ensures popular quality games are included.
 * This avoids the "top 500 by rating" trap where niche games get missed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import type { QuestionnaireState } from '@/types/questionnaire';
import { rowToGame } from '@/lib/supabase/games';
import {
  scoreGames,
  DEFAULT_WEIGHTS,
  POPULAR_WEIGHTS,
  HIDDEN_GEMS_WEIGHTS,
} from '@/lib/recommendation/scoring';
import type { ScoringWeights } from '@/lib/recommendation/scoring';
import { computeSimilarityInMemory, fetchVectorCandidates } from '@/lib/recommendation/similarity';
import { MemoryCache } from '@/lib/cache';
import { redisCache } from '@/lib/redis';
import { diversityRerank } from '@/lib/recommendation/diversity';
import { buildRejectionProfile, computeRejectionPenalty } from '@/lib/recommendation/rejection';

// ─── Config ──────────────────────────────────────────────────

/** Per-source candidate limits (rating-based + vector-based) */
const RATING_POOL_SIZE = 250;
const VECTOR_POOL_SIZE = 250;
const DEFAULT_RESULT_LIMIT = 100;
const MAX_RESULT_LIMIT = 200;
const SIMILARITY_CANDIDATES = 100;

const RULE_WEIGHT = 0.6;
const SIMILARITY_WEIGHT = 0.4;

type PopularityMode = 'popular' | 'any' | 'hidden-gems';

// ─── Caching ─────────────────────────────────────────────────

/** Cache recommendation results for identical preferences (2 min TTL) */
const recommendCache = new MemoryCache<unknown>(120, 50);

/** Generate a cache key from preferences */
function cacheKey(prefs: QuestionnaireState, popularity: string): string {
  return JSON.stringify({
    t: [...prefs.gameTypes].sort(),
    pc: prefs.playerCount,
    ta: [...prefs.timePresets].sort(),
    cx: prefs.complexity,
    g: [...prefs.genres].sort(),
    m: [...prefs.moods].sort(),
    ft: prefs.freeText,
    p: popularity,
  });
}

// ─── DB Client ───────────────────────────────────────────────

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: QuestionnaireState & {
    limit?: number;
    popularity?: PopularityMode;
    minRating?: number;
    minTime?: number;
    maxTime?: number;
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createDbClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const limit = Math.min(body.limit ?? DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT);
  const popularity: PopularityMode = body.popularity ?? 'popular';

  // Check caches: Redis (persistent) → in-memory (warm start)
  const key = cacheKey(body, popularity);
  const redisKey = `rec:${key}`;

  const memoryCached = recommendCache.get(key);
  if (memoryCached) {
    return NextResponse.json(memoryCached);
  }

  const redisCached = await redisCache.get<unknown>(redisKey);
  if (redisCached) {
    recommendCache.set(key, redisCached); // Warm the in-memory cache
    return NextResponse.json(redisCached);
  }

  try {
    // Step 1: Hybrid candidate fetching
    // Two parallel sources: vector similarity + rating-based.
    // Vector finds niche games matching preferences (roguelike deck builders).
    // Rating finds generally excellent games. Deduplicate and score all.
    const extra = {
      minRating: body.minRating,
      minTime: body.minTime,
      maxTime: body.maxTime,
    };

    const [ratingCandidates, vectorCandidates, textCandidates] = await Promise.all([
      fetchCandidates(supabase, body, popularity, extra),
      fetchVectorCandidates(body, { limit: VECTOR_POOL_SIZE, columns: GAME_COLUMNS }),
      body.freeText && body.freeText.trim().length >= 3
        ? fetchTextSearchCandidates(supabase, body.freeText)
        : Promise.resolve([]),
    ]);

    // Deduplicate: rating-based first, then merge in vector + text matches
    const seen = new Set<string>();
    let candidates = [...ratingCandidates];
    for (const g of candidates) seen.add(g.id);

    for (const g of vectorCandidates) {
      if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); }
    }
    for (const g of textCandidates) {
      if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); }
    }

    console.log(`[Recommend] Hybrid pool: ${ratingCandidates.length} rating + ${vectorCandidates.length} vector + ${textCandidates.length} text = ${candidates.length} unique`);

    // Progressive fallbacks (only if hybrid produced nothing)
    if (candidates.length === 0) {
      console.log('[Recommend] No results with type filter, dropping type constraint');
      candidates = await fetchCandidatesNoType(supabase, body, popularity);
    }

    if (candidates.length === 0) {
      console.log('[Recommend] No results with player count, dropping all constraints');
      candidates = await fetchCandidatesFallback(supabase, popularity);
    }

    if (candidates.length === 0) {
      console.log('[Recommend] Nuclear fallback — dropping quality floor');
      candidates = await fetchCandidatesNuclear(supabase);
    }

    // Step 1c: If LLM parsed "similarTo" game names, resolve them and
    // merge their categories/mechanics into genres for scoring boost
    if (body.llmParsed?.similarTo?.length) {
      const resolvedTags = await resolveSimilarToGames(supabase, body.llmParsed.similarTo);
      if (resolvedTags.length > 0) {
        body.genres = [...new Set([...body.genres, ...resolvedTags])];
      }
    }

    // Step 2: Rule-based scoring (fast, in-memory)
    const weights = getWeightsForMode(popularity);
    const scored = scoreGames(candidates, body, weights);

    // Step 3: In-memory similarity on top candidates only (skip if too few)
    let engineVersion = vectorCandidates.length > 0 ? 'hybrid-vector-v2' : 'rule-based-v1';
    const topCandidates = candidates.slice(0, SIMILARITY_CANDIDATES);
    if (topCandidates.length >= 5) {
      const inMemory = computeSimilarityInMemory(body, topCandidates, topCandidates.length);
      const similarityMap = new Map(inMemory.map((s) => [s.game.id, s.similarity]));

      // Combine scores
      for (const item of scored) {
        const sim = similarityMap.get(item.game.id) ?? 0;
        item.score = item.score * RULE_WEIGHT + sim * SIMILARITY_WEIGHT;
      }
      scored.sort((a, b) => b.score - a.score);
      engineVersion = vectorCandidates.length > 0 ? 'hybrid-vector-v2' : 'hybrid-inmemory-v1';
    }

    // Step 4: Apply rejection penalties (if user has negative feedback)
    const rejectionProfile = await buildRejectionProfile(body.userId ?? null);
    if (rejectionProfile) {
      for (const item of scored) {
        const penalty = computeRejectionPenalty(item.game, rejectionProfile);
        if (penalty > 0) {
          item.score *= (1 - penalty);
        }
      }
      scored.sort((a, b) => b.score - a.score);
    }

    // Step 5: Diversity re-ranking (prevent 20 strategy games in a row)
    const diversified = diversityRerank(scored);

    // Step 6: Take top N
    const topResults = diversified.slice(0, limit);

    const response = {
      results: topResults.map(({ game, score, reasons, breakdown }) => ({
        ...game,
        _score: Math.round(score * 1000) / 1000,
        _reasons: reasons,
        _breakdown: breakdown,
      })),
      count: topResults.length,
      totalCandidates: candidates.length,
      engine: engineVersion,
      popularity,
    };

    // Cache responses with results in both layers
    if (topResults.length > 0) {
      recommendCache.set(key, response);
      redisCache.set(redisKey, response, 120); // 2 min TTL in Redis
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Recommend] Error:', error);
    return NextResponse.json({ error: 'Recommendation failed' }, { status: 500 });
  }
}

// ─── Candidate Fetching ──────────────────────────────────────

/** Column list for game queries */
const GAME_COLUMNS = 'id,source,source_id,name,description,year_published,types,min_players,max_players,recommended_players,min_play_time,max_play_time,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url';

/**
 * Fetch candidates with MINIMAL hard constraints.
 *
 * Philosophy: the DB query casts a WIDE net. Only filters that make
 * a game physically unplayable (wrong player count) are hard constraints.
 * Everything else (type, time, complexity, genre) is handled by the
 * scoring engine, which ranks by relevance instead of excluding.
 *
 * This ensures users ALWAYS get results, even with unusual combinations.
 */
async function fetchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
  popularity: PopularityMode,
  extra?: { minRating?: number; minTime?: number; maxTime?: number },
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null);

  // ── Quality floor (always applied) ──
  if (popularity === 'popular') {
    query = query.gte('rating_count', 50);
    query = query.gte('rating', 4.5);
  } else if (popularity === 'hidden-gems') {
    query = query.lt('rating_count', 5000);
    query = query.gte('rating_count', 10);
    query = query.gte('rating', 5.5);
  } else {
    query = query.gte('rating_count', 5);
  }

  // ── Player count: HARD constraint ──
  // You physically can't play a 4-min game with 2 people
  if (prefs.playerCount) {
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  // ── Extra refine filters (from results page) ──
  if (extra?.minRating && extra.minRating > 0) {
    query = query.gte('rating', extra.minRating);
  }
  if (extra?.minTime && extra.minTime > 0) {
    query = query.gte('avg_play_time', extra.minTime);
  }
  if (extra?.maxTime && extra.maxTime < 300) {
    query = query.lte('avg_play_time', extra.maxTime);
  }

  // ── Game type: soft filter at DB level (helps narrow pool) ──
  // Applied as a filter but NOT a dealbreaker — fallback removes this
  if (prefs.gameTypes.length === 1) {
    query = query.contains('types', [prefs.gameTypes[0]]);
  } else if (prefs.gameTypes.length > 1) {
    query = query.or(prefs.gameTypes.map((t: string) => `types.cs.{${t}}`).join(','));
  }

  // Time, complexity, genres are NOT filtered at DB level.
  // The scoring engine handles them as weighted preferences.

  query = query
    .order('rating', { ascending: false })
    .limit(RATING_POOL_SIZE);

  const { data, error } = await query;

  if (error) {
    console.error('[Recommend] DB query error:', error);
    return [];
  }

  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Supplemental text search: finds games matching free text keywords
 * in name, categories, mechanics, or themes. Returns up to 50 results.
 */
async function fetchTextSearchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  freeText: string,
) {
  // Use Postgres full-text search on game name
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null)
    .textSearch('name', freeText.trim(), { type: 'websearch' })
    .order('rating', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Fallback 1: Keep player count but drop game type filter.
 * Handles cases like "word game for 7 players" where no word games
 * support that count, but plenty of board/party games do.
 */
async function fetchCandidatesNoType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
  popularity: PopularityMode,
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null);

  // Quality floor
  if (popularity === 'popular') {
    query = query.gte('rating_count', 30);
  } else {
    query = query.gte('rating_count', 3);
  }

  // Player count only (no type filter)
  if (prefs.playerCount) {
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  query = query.order('rating', { ascending: false }).limit(RATING_POOL_SIZE);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Fallback 2: No preference filters at all, just quality floor.
 * Returns the top-rated games regardless of type, player count, etc.
 */
async function fetchCandidatesFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  popularity: PopularityMode,
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null);

  if (popularity === 'popular') {
    query = query.gte('rating_count', 20);
  } else {
    query = query.gte('rating_count', 3);
  }

  query = query.order('rating', { ascending: false }).limit(RATING_POOL_SIZE);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Fallback 3: Nuclear option. No filters at all — just grab games.
 * This should literally never return 0 unless the DB is empty.
 */
async function fetchCandidatesNuclear(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
) {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .order('rating_count', { ascending: false })
    .limit(RATING_POOL_SIZE);

  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

// ─── SimilarTo Resolution ────────────────────────────────────

/**
 * Looks up games by name from the "similarTo" list and returns
 * their categories, mechanics, and themes as a flat array.
 * These get merged into the user's genre preferences so the
 * existing scoreGenreMatch picks them up.
 */
async function resolveSimilarToGames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  similarTo: string[],
): Promise<string[]> {
  const allTags: string[] = [];

  const lookups = similarTo.slice(0, 5).map(async (name) => {
    const { data } = await supabase
      .from('games')
      .select('categories, mechanics, themes')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (data) {
      allTags.push(...(data.categories ?? []), ...(data.mechanics ?? []), ...(data.themes ?? []));
    }
  });

  await Promise.all(lookups);
  return [...new Set(allTags)];
}

// ─── Helpers ─────────────────────────────────────────────────

function getWeightsForMode(popularity: PopularityMode): ScoringWeights {
  switch (popularity) {
    case 'popular': return POPULAR_WEIGHTS;
    case 'hidden-gems': return HIDDEN_GEMS_WEIGHTS;
    default: return DEFAULT_WEIGHTS;
  }
}
