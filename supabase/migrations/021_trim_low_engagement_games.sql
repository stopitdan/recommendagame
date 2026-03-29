-- ============================================================
-- Migration 021: Remove Low-Engagement Games
-- ============================================================
-- 115k of 152k games have fewer than 50 ratings. These include:
-- - Failed Kickstarters that were never produced
-- - Print-and-play prototypes nobody plays
-- - Obscure self-published games with no community presence
-- - Duplicate/variant entries
--
-- Keeping only games with 50+ ratings leaves ~37k quality games
-- that real people actually play. This dramatically improves
-- recommendation quality and query performance.
-- ============================================================

-- First clean up references
DELETE FROM public.user_game_feedback
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 50
);

DELETE FROM public.user_favorites
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 50
);

DELETE FROM public.user_reviews
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 50
);

-- Delete the low-engagement games (game_embeddings cascade via FK)
DELETE FROM public.games
WHERE rating_count < 50;

ANALYZE public.games;
ANALYZE public.game_embeddings;
