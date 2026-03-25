/**
 * POST /api/recommend
 *
 * The main recommendation endpoint. Combines multiple layers:
 *
 *   Layer 1: Rule-based scoring — scores games on 8 weighted dimensions
 *   Layer 2: Content-based filtering — cosine similarity via embeddings
 *   Layer 3: Collaborative filtering — (future) user-to-user patterns
 *
 * The engine automatically uses the best available layer:
 * - If pgvector embeddings exist → pgvector similarity + rule scoring
 * - If no embeddings → in-memory similarity + rule scoring
 * - Rule-based scoring always runs as the final ranker
 *
 * Request body: QuestionnaireState (see src/types/questionnaire.ts)
 * Response: { results: ScoredGame[], count: number, engine: string }
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
import { findSimilarToPreferences } from '@/lib/recommendation/similarity';

// ─── Config ──────────────────────────────────────────────────

const CANDIDATE_POOL_SIZE = 500;
const DEFAULT_RESULT_LIMIT = 20;
const MAX_RESULT_LIMIT = 50;

/** Weight given to rule-based score vs similarity score in hybrid ranking */
const RULE_WEIGHT = 0.6;
const SIMILARITY_WEIGHT = 0.4;

type PopularityMode = 'popular' | 'any' | 'hidden-gems';

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

  try {
    // Step 1: Fetch candidates using DB filters
    const candidates = await fetchCandidates(supabase, body, popularity);

    // Step 2: Try to get similarity scores (Layer 2)
    let engineVersion = 'rule-based-v1';
    let similarityMap = new Map<string, number>();

    // Check if embeddings exist
    const hasEmbeddings = await checkEmbeddingsExist(supabase);

    if (hasEmbeddings) {
      // Use pgvector similarity search
      try {
        const similar = await findSimilarToPreferences(body, {
          limit: CANDIDATE_POOL_SIZE,
          similarityThreshold: 0.1,
          gameTypeFilter: body.gameType,
        });
        similarityMap = new Map(similar.map((s) => [s.game.id, s.similarity]));
        engineVersion = 'hybrid-v1';
      } catch (err) {
        console.warn('[Recommend] pgvector failed, falling back:', err);
      }
    }

    // Fallback: in-memory similarity if pgvector didn't work but we have candidates
    if (similarityMap.size === 0 && candidates.length > 0) {
      const inMemory = computeSimilarityInMemory(body, candidates, candidates.length);
      similarityMap = new Map(inMemory.map((s) => [s.game.id, s.similarity]));
      if (engineVersion === 'rule-based-v1') {
        engineVersion = 'hybrid-inmemory-v1';
      }
    }

    // Step 3: Rule-based scoring (Layer 1 — always runs)
    const weights = getWeightsForMode(popularity);
    const scored = scoreGames(candidates, body, weights);

    // Step 4: Combine rule score + similarity score for hybrid ranking
    const hybridScored = scored.map((item) => {
      const similarity = similarityMap.get(item.game.id) ?? 0;
      const hybridScore = item.score * RULE_WEIGHT + similarity * SIMILARITY_WEIGHT;

      return {
        ...item,
        score: hybridScore,
        similarity,
      };
    });

    // Re-sort by hybrid score
    hybridScored.sort((a, b) => b.score - a.score);

    // Step 5: Take top N
    const topResults = hybridScored.slice(0, limit);

    return NextResponse.json({
      results: topResults.map(({ game, score, reasons, breakdown, similarity }) => ({
        ...game,
        _score: Math.round(score * 1000) / 1000,
        _similarity: Math.round(similarity * 1000) / 1000,
        _reasons: reasons,
        _breakdown: breakdown,
      })),
      count: topResults.length,
      totalCandidates: candidates.length,
      engine: engineVersion,
      popularity,
    });
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
  let query = supabase
    .from('games')
    .select('*')
    .not('rating', 'is', null);

  if (prefs.gameType) {
    query = query.contains('types', [prefs.gameType]);
  }

  if (popularity === 'popular') {
    query = query.gt('rating_count', 20);
  } else if (popularity === 'hidden-gems') {
    query = query.lt('rating_count', 2000);
    query = query.gte('rating', 5.5);
  }

  if (prefs.playerCount) {
    // Hard constraint: game must be playable within the user's range.
    // min_players must be <= user's max (otherwise game needs more people than they have)
    // max_players must be >= user's min (otherwise game can't accommodate their group)
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  if (prefs.timeAvailable && TIME_PRESETS[prefs.timeAvailable]) {
    const preset = TIME_PRESETS[prefs.timeAvailable];
    const looseMin = Math.max(0, preset.minMinutes - Math.floor(preset.minMinutes * 0.5));
    const looseMax = preset.maxMinutes < 999
      ? preset.maxMinutes + Math.floor(preset.maxMinutes * 0.5)
      : 9999;
    query = query.gte('avg_play_time', looseMin);
    query = query.lte('avg_play_time', looseMax);
  }

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

/** Checks if any embeddings exist in the database */
async function checkEmbeddingsExist(supabase: any): Promise<boolean> {
  const { count, error } = await supabase
    .from('game_embeddings')
    .select('*', { count: 'exact', head: true });

  return !error && (count ?? 0) > 0;
}

function getWeightsForMode(popularity: PopularityMode): ScoringWeights {
  switch (popularity) {
    case 'popular': return POPULAR_WEIGHTS;
    case 'hidden-gems': return HIDDEN_GEMS_WEIGHTS;
    default: return DEFAULT_WEIGHTS;
  }
}
