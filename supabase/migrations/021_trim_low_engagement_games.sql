-- ============================================================
-- Migration 021: Remove Low-Engagement Games
-- ============================================================
-- 71k of 152k games have fewer than 10 ratings. These include:
-- - Failed Kickstarters that were never produced
-- - Print-and-play prototypes nobody plays
-- - Obscure self-published games with no community presence
--
-- Keeping only games with 10+ ratings leaves ~81k games.
-- Still a massive catalog but without the ghost entries.
-- ============================================================

-- First clean up references
DELETE FROM public.user_game_feedback
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 10
);

DELETE FROM public.user_favorites
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 10
);

DELETE FROM public.user_reviews
WHERE game_id IN (
  SELECT id FROM public.games WHERE rating_count < 10
);

-- Delete the low-engagement games (game_embeddings cascade via FK)
DELETE FROM public.games
WHERE rating_count < 10;

ANALYZE public.games;
ANALYZE public.game_embeddings;
