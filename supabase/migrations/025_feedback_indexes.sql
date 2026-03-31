-- ============================================================
-- Migration 025: Composite Indexes for Feedback Queries
-- ============================================================
-- Collaborative filtering queries user_game_feedback and
-- user_reviews by (user_id, rating). These composite indexes
-- let those queries use index scans instead of seq scans.
-- ============================================================

-- user_game_feedback: used by recommendation endpoint to get liked games
CREATE INDEX IF NOT EXISTS idx_user_game_feedback_user_rating
  ON public.user_game_feedback (user_id, rating);

-- user_reviews: used by collaborative filtering to find similar users
CREATE INDEX IF NOT EXISTS idx_user_reviews_user_rating
  ON public.user_reviews (user_id, rating);

-- user_reviews: used by item-based CF to find games liked by similar users
CREATE INDEX IF NOT EXISTS idx_user_reviews_game_rating
  ON public.user_reviews (game_id, rating);

ANALYZE public.user_game_feedback;
ANALYZE public.user_reviews;
