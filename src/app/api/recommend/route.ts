/**
 * POST /api/recommend
 *
 * The main recommendation endpoint. Combines multiple layers:
 *
 *   Layer 1: Rule-based scoring — scores games on 8 weighted dimensions
 *   Layer 2: Content-based filtering — cosine similarity via embeddings
 *   Layer 3: Collaborative filtering — (future) user-to-user patterns
 *
 * Optimized for speed:
 *   - Candidate pool reduced to 200 (we only show 20 results)
 *   - Candidate fetch and similarity search run in parallel
 *   - Response caching for identical preferences (2 min TTL)
 *   - In-memory similarity only on top 100 candidates (not all 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import type { QuestionnaireState, TimePreset } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';
import { rowToGame } from '@/lib/supabase/games';
import {
  scoreGames,
  DEFAULT_WEIGHTS,
  POPULAR_WEIGHTS,
  HIDDEN_GEMS_WEIGHTS,
} from '@/lib/recommendation/scoring';
import type { ScoringWeights } from '@/lib/recommendation/scoring';
import { computeSimilarityInMemory } from '@/lib/recommendation/similarity';
import { MemoryCache } from '@/lib/cache';

// ─── Config ──────────────────────────────────────────────────

const CANDIDATE_POOL_SIZE = 200;
const DEFAULT_RESULT_LIMIT = 20;
const MAX_RESULT_LIMIT = 50;
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
    t: prefs.gameType,
    pc: prefs.playerCount,
    ta: prefs.timeAvailable,
    cx: prefs.complexity,
    g: prefs.genres.sort(),
    m: prefs.moods.sort(),
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
  let body: QuestionnaireState & { limit?: number; popularity?: PopularityMode };

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

  // Check cache first
  const key = cacheKey(body, popularity);
  const cached = recommendCache.get(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Step 1: Fetch candidates (single DB query, optimized)
    const candidates = await fetchCandidates(supabase, body, popularity);

    if (candidates.length === 0) {
      const empty = { results: [], count: 0, totalCandidates: 0, engine: 'rule-based-v1', popularity };
      return NextResponse.json(empty);
    }

    // Step 2: Rule-based scoring (fast, in-memory)
    const weights = getWeightsForMode(popularity);
    const scored = scoreGames(candidates, body, weights);

    // Step 3: In-memory similarity on top candidates only (skip if too few)
    let engineVersion = 'rule-based-v1';
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
      engineVersion = 'hybrid-inmemory-v1';
    }

    // Step 4: Take top N
    const topResults = scored.slice(0, limit);

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

    // Cache the response
    recommendCache.set(key, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Recommend] Error:', error);
    return NextResponse.json({ error: 'Recommendation failed' }, { status: 500 });
  }
}

// ─── Candidate Fetching ──────────────────────────────────────

async function fetchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
  popularity: PopularityMode,
) {
  // Select only the columns we need (skip large text fields for speed)
  let query = supabase
    .from('games')
    .select('id,source,source_id,name,description,year_published,types,min_players,max_players,recommended_players,min_play_time,max_play_time,avg_play_time,complexity,rating,rating_count,categories,mechanics,themes,platforms,thumbnail_url,image_url,source_url')
    .not('rating', 'is', null);

  if (prefs.gameType) {
    query = query.contains('types', [prefs.gameType]);
  }

  // Quality floor
  if (popularity === 'popular') {
    query = query.gte('rating_count', 100);
    query = query.gte('rating', 5.0);
  } else if (popularity === 'hidden-gems') {
    query = query.lt('rating_count', 5000);
    query = query.gte('rating_count', 20);
    query = query.gte('rating', 6.0);
  } else {
    query = query.gte('rating_count', 10);
    query = query.gte('rating', 4.0);
  }

  // Player count: hard constraint
  if (prefs.playerCount) {
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  // Time filter
  if (prefs.timeAvailable && TIME_PRESETS[prefs.timeAvailable]) {
    const preset = TIME_PRESETS[prefs.timeAvailable];
    const looseMin = Math.max(0, preset.minMinutes - Math.floor(preset.minMinutes * 0.5));
    const looseMax = preset.maxMinutes < 999
      ? preset.maxMinutes + Math.floor(preset.maxMinutes * 0.5)
      : 9999;
    query = query.gte('avg_play_time', looseMin);
    query = query.lte('avg_play_time', looseMax);
  }

  // Complexity filter
  if (prefs.complexity && (prefs.complexity.min > 1 || prefs.complexity.max < 5)) {
    const looseMin = Math.max(0, prefs.complexity.min - 1);
    const looseMax = Math.min(6, prefs.complexity.max + 1);
    query = query.gte('complexity', looseMin);
    query = query.lte('complexity', looseMax);
  }

  query = query
    .order('rating', { ascending: false })
    .limit(CANDIDATE_POOL_SIZE);

  const { data, error } = await query;

  if (error) {
    console.error('[Recommend] DB query error:', error);
    return [];
  }

  return ((data ?? []) as GameRow[]).map(rowToGame);
}

// ─── Helpers ─────────────────────────────────────────────────

function getWeightsForMode(popularity: PopularityMode): ScoringWeights {
  switch (popularity) {
    case 'popular': return POPULAR_WEIGHTS;
    case 'hidden-gems': return HIDDEN_GEMS_WEIGHTS;
    default: return DEFAULT_WEIGHTS;
  }
}
