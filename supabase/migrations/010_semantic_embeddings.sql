-- ============================================================================
-- Semantic Embeddings (OpenAI text-embedding-3-small, 1536 dimensions)
-- ============================================================================
-- Adds a real semantic embedding column alongside the existing hash-based
-- 768-dim vectors. These capture actual meaning — "build your deck" is
-- semantically close to "Deck Building" even without exact tag matches.

-- Add semantic embedding column
ALTER TABLE public.game_embeddings
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS semantic_model text;

-- HNSW index for fast semantic similarity search
CREATE INDEX IF NOT EXISTS idx_game_semantic_embeddings
  ON public.game_embeddings
  USING hnsw (semantic_embedding vector_cosine_ops);

-- RPC for semantic matching (same pattern as match_games but for 1536-dim)
CREATE OR REPLACE FUNCTION match_games_semantic(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  game_id text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ge.game_id,
    1 - (ge.semantic_embedding <=> query_embedding) AS similarity
  FROM public.game_embeddings ge
  WHERE ge.semantic_embedding IS NOT NULL
    AND 1 - (ge.semantic_embedding <=> query_embedding) > similarity_threshold
  ORDER BY ge.semantic_embedding <=> query_embedding
  LIMIT match_count;
$$;
