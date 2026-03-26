/**
 * Embedding Completeness Diagnostic
 *
 * Checks the health of the recommendation system by comparing
 * game counts, embedding counts, and data quality.
 *
 * Usage:
 *   npx tsx scripts/check-embeddings.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env vars');

  const supabase = createClient(url, key);

  console.log('=== Recommendation System Health Check ===\n');

  // Total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  console.log(`Total games:        ${totalGames ?? 'ERROR'}`);

  // Games with ratings
  const { count: ratedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null);
  console.log(`Games with rating:  ${ratedGames ?? 'ERROR'}`);
  console.log(`Games without rating: ${(totalGames ?? 0) - (ratedGames ?? 0)}`);

  // Embeddings
  const { count: embeddings } = await supabase
    .from('game_embeddings')
    .select('*', { count: 'exact', head: true });
  console.log(`\nEmbeddings:         ${embeddings ?? 'ERROR'}`);
  const coverage = totalGames ? Math.round(((embeddings ?? 0) / totalGames) * 100) : 0;
  console.log(`Embedding coverage: ${coverage}%`);

  // Games by source
  for (const source of ['bgg', 'rawg', 'igdb', 'local']) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('source', source);
    console.log(`  ${source}: ${count ?? 0} games`);
  }

  // Games with player count
  const { count: withPlayers } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('min_players', 'is', null);
  console.log(`\nGames with player count: ${withPlayers ?? 0}`);

  // Test the match_games RPC
  console.log('\n--- RPC Test ---');
  const dummyVector = new Array(768).fill(0);
  dummyVector[0] = 1; // Non-zero so it's a valid direction
  const { data: rpcResult, error: rpcError } = await supabase.rpc('match_games', {
    query_embedding: `[${dummyVector.join(',')}]`,
    match_count: 5,
    similarity_threshold: 0.01,
  });
  if (rpcError) {
    console.log(`match_games RPC:    FAILED — ${rpcError.message}`);
  } else {
    console.log(`match_games RPC:    OK (${rpcResult?.length ?? 0} results for dummy vector)`);
  }

  // Popular games quality check
  const { data: topGames } = await supabase
    .from('games')
    .select('name, rating, rating_count')
    .not('rating', 'is', null)
    .order('rating', { ascending: false })
    .limit(5);
  console.log('\n--- Top 5 by Rating ---');
  for (const g of topGames ?? []) {
    console.log(`  ${(g as any).rating?.toFixed(1)} (${(g as any).rating_count} votes) — ${(g as any).name}`);
  }

  // 2-player games check (the failing query)
  const { count: twoPlayerGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null)
    .lte('min_players', 2)
    .gte('max_players', 2)
    .gte('rating_count', 50);
  console.log(`\n2-player games (popular): ${twoPlayerGames ?? 0}`);

  console.log('\n=== Done ===');
}

main().catch(console.error);
