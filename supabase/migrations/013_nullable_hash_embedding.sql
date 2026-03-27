-- ============================================================================
-- Make hash-based embedding column nullable
-- ============================================================================
-- The original embedding column (768-dim hash vectors) was NOT NULL, preventing
-- games from receiving semantic embeddings (1536-dim OpenAI) unless they
-- already had hash-based embeddings. Making it nullable allows either embedding
-- type to exist independently.

ALTER TABLE public.game_embeddings
  ALTER COLUMN embedding DROP NOT NULL;
