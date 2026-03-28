-- ============================================================
-- Migration 014: Trim Dead Games
-- ============================================================
-- Remove ~76k games that have no rating AND no rating_count.
-- These are unrated, unreviewed games that bloat every query by ~43%.
--
-- Safety: First removes any orphaned references, then deletes games.
-- game_embeddings has ON DELETE CASCADE, so those rows are cleaned up
-- automatically.
-- ============================================================

-- Step 1: Delete feedback referencing dead games (if any)
DELETE FROM public.user_game_feedback
WHERE game_id IN (
  SELECT id FROM public.games
  WHERE rating IS NULL
    AND (rating_count IS NULL OR rating_count = 0)
);

-- Step 2: Delete favorites referencing dead games (if any)
DELETE FROM public.user_favorites
WHERE game_id IN (
  SELECT id FROM public.games
  WHERE rating IS NULL
    AND (rating_count IS NULL OR rating_count = 0)
);

-- Step 3: Delete reviews referencing dead games (if any)
DELETE FROM public.user_reviews
WHERE game_id IN (
  SELECT id FROM public.games
  WHERE rating IS NULL
    AND (rating_count IS NULL OR rating_count = 0)
);

-- Step 4: Delete the dead games (game_embeddings cascade-deletes via FK)
DELETE FROM public.games
WHERE rating IS NULL
  AND (rating_count IS NULL OR rating_count = 0);

-- Step 5: Update table statistics for query planner
ANALYZE public.games;
ANALYZE public.game_embeddings;
