/**
 * GET /api/games/[id]/similar
 *
 * Returns games similar to the given game, using the content-based
 * similarity engine (Layer 2). Falls back to category-based matching
 * if embeddings aren't available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rowToGame } from '@/lib/supabase/games';
import { gameToVector, normalize, cosineSimilarity } from '@/lib/recommendation/embeddings';
import { similarGamesCache } from '@/lib/cache';
import type { GameRow } from '@/types/supabase';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Check cache first
  const cached = similarGamesCache.get(id);
  if (cached) {
    return NextResponse.json(cached);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Get the source game
  const { data: sourceRow, error: sourceError } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single();

  if (sourceError || !sourceRow) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const sourceGame = rowToGame(sourceRow as GameRow);
  const sourceVector = normalize(gameToVector(sourceGame));

  // Try pgvector similarity first
  const { data: embData } = await supabase
    .from('game_embeddings')
    .select('embedding')
    .eq('game_id', id)
    .single();

  let similarIds: string[] = [];

  if (embData?.embedding) {
    // Use pgvector RPC for fast similarity search
    const { data: matches } = await supabase.rpc('match_games', {
      query_embedding: embData.embedding,
      match_count: 11,
      similarity_threshold: 0.3,
    });

    if (matches) {
      similarIds = matches
        .filter((m: { game_id: string }) => m.game_id !== id)
        .map((m: { game_id: string }) => m.game_id)
        .slice(0, 8);
    }
  }

  // Fallback: category-based matching
  if (similarIds.length === 0 && sourceGame.categories.length > 0) {
    const { data: catMatches } = await supabase
      .from('games')
      .select('*')
      .neq('id', id)
      .contains('types', sourceGame.types)
      .not('rating', 'is', null)
      .gte('rating_count', 20)
      .order('rating', { ascending: false })
      .limit(50);

    if (catMatches) {
      // Score by category overlap + in-memory vector similarity
      const scored = (catMatches as GameRow[])
        .map((row) => {
          const game = rowToGame(row);
          const vec = normalize(gameToVector(game));
          const sim = cosineSimilarity(sourceVector, vec);
          return { game, sim };
        })
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 8);

      const result = {
        similar: scored.map((s) => ({ ...s.game, _similarity: Math.round(s.sim * 1000) / 1000 })),
        method: 'category-fallback',
      };
      similarGamesCache.set(id, result);
      return NextResponse.json(result);
    }
  }

  // Fetch full game data for similar IDs
  if (similarIds.length > 0) {
    const { data: gameRows } = await supabase
      .from('games')
      .select('*')
      .in('id', similarIds);

    if (gameRows) {
      const games = (gameRows as GameRow[]).map((row) => rowToGame(row));
      const result = { similar: games, method: 'pgvector' };
      similarGamesCache.set(id, result);
      return NextResponse.json(result);
    }
  }

  return NextResponse.json({ similar: [], method: 'none' });
}
