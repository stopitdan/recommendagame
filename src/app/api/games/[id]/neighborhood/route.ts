/**
 * GET /api/games/[id]/neighborhood
 *
 * Returns a game and its nearest neighbors for the visual game map.
 * Uses pgvector similarity (if embeddings exist) with in-memory fallback.
 * Cached in Redis for 1 hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import { gameToVector, normalize, cosineSimilarity } from '@/lib/recommendation/embeddings';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

const NEIGHBOR_COUNT = 20;
const CACHE_TTL = 3600; // 1 hour

interface NeighborNode {
  id: string;
  name: string;
  rating: number | undefined;
  ratingCount: number | undefined;
  types: string[];
  categories: string[];
  imageUrl: string | undefined;
  similarity: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cacheKey = `neighborhood:${id}`;
  const skipCache = shouldSkipCache(request);

  if (!skipCache) {
    const cached = await redisCache.get<unknown>(cacheKey);
    if (cached) return jsonWithCacheHeader(cached, true);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const supabase = createClient(url, key);

  // Fetch the center game
  const { data: centerData } = await supabase
    .from('games')
    .select(GAME_SELECT_COLUMNS)
    .eq('id', id)
    .single();

  if (!centerData) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const centerGame = rowToGame(centerData as GameRow);

  // Try pgvector similarity first
  const { data: embData } = await supabase
    .from('game_embeddings')
    .select('embedding')
    .eq('game_id', id)
    .single();

  let neighbors: NeighborNode[] = [];

  if (embData?.embedding) {
    const { data: matches } = await supabase.rpc('match_games', {
      query_embedding: embData.embedding,
      match_count: NEIGHBOR_COUNT + 1,
      similarity_threshold: 0.2,
    });

    if (matches && matches.length > 0) {
      const neighborIds = matches
        .filter((m: { game_id: string }) => m.game_id !== id)
        .slice(0, NEIGHBOR_COUNT);

      const ids = neighborIds.map((m: { game_id: string }) => m.game_id);
      const simMap = new Map<string, number>(
        neighborIds.map((m: { game_id: string; similarity: number }) => [m.game_id, m.similarity])
      );

      const { data: neighborData } = await supabase
        .from('games')
        .select(GAME_SELECT_COLUMNS)
        .in('id', ids);

      if (neighborData) {
        neighbors = (neighborData as GameRow[]).map((row) => {
          const game = rowToGame(row);
          return {
            id: game.id,
            name: game.name,
            rating: game.rating,
            ratingCount: game.ratingCount,
            types: game.types,
            categories: game.categories.slice(0, 3),
            imageUrl: game.thumbnailUrl ?? game.imageUrl,
            similarity: simMap.get(game.id) ?? 0,
          };
        });
      }
    }
  }

  // Fallback: in-memory vector similarity
  if (neighbors.length === 0) {
    const centerVector = normalize(gameToVector(centerGame));

    // Fetch a pool of candidates (same type, popular)
    let query = supabase
      .from('games')
      .select(GAME_SELECT_COLUMNS)
      .neq('id', id)
      .eq('is_expansion', false)
      .gte('rating_count', 50)
      .order('rating_count', { ascending: false })
      .limit(200);

    if (centerGame.types.length > 0) {
      query = query.contains('types', [centerGame.types[0]]);
    }

    const { data: pool } = await query;
    if (pool) {
      const scored = (pool as GameRow[]).map((row) => {
        const game = rowToGame(row);
        const vec = normalize(gameToVector(game));
        const sim = cosineSimilarity(centerVector, vec);
        return { game, sim };
      });

      scored.sort((a, b) => b.sim - a.sim);

      neighbors = scored.slice(0, NEIGHBOR_COUNT).map(({ game, sim }) => ({
        id: game.id,
        name: game.name,
        rating: game.rating,
        ratingCount: game.ratingCount,
        types: game.types,
        categories: game.categories.slice(0, 3),
        imageUrl: game.thumbnailUrl ?? game.imageUrl,
        similarity: Math.round(sim * 1000) / 1000,
      }));
    }
  }

  // Sort neighbors by similarity descending
  neighbors.sort((a, b) => b.similarity - a.similarity);

  const response = {
    center: {
      id: centerGame.id,
      name: centerGame.name,
      rating: centerGame.rating,
      ratingCount: centerGame.ratingCount,
      types: centerGame.types,
      categories: centerGame.categories.slice(0, 3),
      imageUrl: centerGame.thumbnailUrl ?? centerGame.imageUrl,
    },
    neighbors,
  };

  await redisCache.set(cacheKey, response, CACHE_TTL);
  return jsonWithCacheHeader(response, false);
}
