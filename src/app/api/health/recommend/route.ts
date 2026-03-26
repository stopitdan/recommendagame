/**
 * GET /api/health/recommend — Recommendation system health check
 *
 * Reports on the health of all recommendation subsystems:
 *   - Game count and embedding coverage
 *   - pgvector RPC availability
 *   - Redis connectivity
 *   - Semantic embedding availability
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const health: Record<string, unknown> = {};

  // Game counts
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  health.totalGames = totalGames ?? 0;

  const { count: ratedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null);
  health.ratedGames = ratedGames ?? 0;

  // Embedding counts
  const { count: hashEmbeddings } = await supabase
    .from('game_embeddings')
    .select('*', { count: 'exact', head: true });
  health.hashEmbeddings = hashEmbeddings ?? 0;
  health.hashCoverage = totalGames ? `${Math.round(((hashEmbeddings ?? 0) / totalGames) * 100)}%` : '0%';

  const { count: semanticEmbeddings } = await supabase
    .from('game_embeddings')
    .select('*', { count: 'exact', head: true })
    .not('semantic_embedding', 'is', null);
  health.semanticEmbeddings = semanticEmbeddings ?? 0;
  health.semanticCoverage = totalGames ? `${Math.round(((semanticEmbeddings ?? 0) / totalGames) * 100)}%` : '0%';

  // Test hash-based RPC
  const dummyVec768 = new Array(768).fill(0);
  dummyVec768[0] = 1;
  const { error: hashRpcError } = await supabase.rpc('match_games', {
    query_embedding: `[${dummyVec768.join(',')}]`,
    match_count: 1,
    similarity_threshold: 0.01,
  });
  health.hashRpc = hashRpcError ? `ERROR: ${hashRpcError.message}` : 'OK';

  // Test semantic RPC
  const dummyVec1536 = new Array(1536).fill(0);
  dummyVec1536[0] = 1;
  const { error: semRpcError } = await supabase.rpc('match_games_semantic', {
    query_embedding: `[${dummyVec1536.join(',')}]`,
    match_count: 1,
    similarity_threshold: 0.01,
  });
  health.semanticRpc = semRpcError ? `NOT AVAILABLE: ${semRpcError.message}` : 'OK';

  // Redis
  health.redis = redisCache.isAvailable() ? 'CONNECTED' : 'NOT CONFIGURED';

  // OpenAI
  health.openai = process.env.OPENAI_API_KEY ? 'CONFIGURED' : 'NOT SET';

  // Overall status
  const isHealthy = (totalGames ?? 0) > 0 && !hashRpcError;
  health.status = isHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(health);
}
