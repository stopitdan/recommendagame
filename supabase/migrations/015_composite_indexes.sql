-- ============================================================
-- Migration 015: Composite Indexes for Common Query Patterns
-- ============================================================
-- After migration 014 trimmed dead games and code now filters
-- is_expansion = false, these composite indexes match the exact
-- WHERE/ORDER BY patterns used by browse and recommend.
-- ============================================================

-- Recommend: main candidate fetch (quality floor + non-expansion + rating sort)
-- Covers: WHERE rating IS NOT NULL AND rating_count >= 50 AND is_expansion = false
--         ORDER BY rating DESC
CREATE INDEX IF NOT EXISTS idx_games_recommend_candidates
  ON public.games (rating DESC NULLS LAST)
  WHERE rating IS NOT NULL
    AND rating_count >= 50
    AND is_expansion = false;

-- Browse: popular games sorted by rating (most common browse query)
-- Covers: WHERE rating_count > 50 AND is_expansion = false ORDER BY rating DESC
CREATE INDEX IF NOT EXISTS idx_games_browse_popular
  ON public.games (rating DESC NULLS LAST)
  WHERE rating_count > 50
    AND is_expansion = false;

-- Browse: hidden gems (low popularity, high quality, non-expansion)
CREATE INDEX IF NOT EXISTS idx_games_browse_hidden_gems
  ON public.games (rating DESC NULLS LAST)
  WHERE rating_count < 500
    AND rating_count > 0
    AND rating > 6
    AND is_expansion = false;

-- Browse: sorted by name for alphabetical browsing
CREATE INDEX IF NOT EXISTS idx_games_browse_name
  ON public.games (name ASC)
  WHERE rating_count > 0
    AND is_expansion = false;

-- Browse: sorted by year for "newest first"
CREATE INDEX IF NOT EXISTS idx_games_browse_year
  ON public.games (year_published DESC NULLS LAST)
  WHERE rating_count > 0
    AND is_expansion = false;

-- Update statistics after index creation
ANALYZE public.games;
