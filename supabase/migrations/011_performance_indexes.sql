-- ============================================================================
-- Performance Indexes + tsvector Columns
-- ============================================================================
-- Fixes 60-100 second query times on 178k games by:
-- 1. Adding partial indexes for exact query patterns (browse, recommend)
-- 2. Adding stored tsvector columns to eliminate ILIKE full table scans
-- 3. Updating RPCs to use stored tsvectors (GIN-indexed, instant)
--
-- Run all of these in your Supabase SQL Editor.
-- Use CREATE INDEX CONCURRENTLY to avoid locking the table.
-- ============================================================================

-- ── Partial Indexes for Browse Patterns ──────────────────────

-- Default browse: WHERE rating_count > 50 ORDER BY rating DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_rating_popular
  ON public.games (rating DESC NULLS LAST)
  WHERE rating_count > 50;

-- Hidden gems: WHERE rating_count < 500 AND rating > 6
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_hidden_gems
  ON public.games (rating DESC NULLS LAST)
  WHERE rating_count < 500 AND rating_count > 0 AND rating > 6;

-- Sort by popularity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_popularity
  ON public.games (rating_count DESC NULLS LAST)
  WHERE rating IS NOT NULL;

-- Sort by name (alphabetical browse)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_name_sorted
  ON public.games (name ASC)
  WHERE rating_count > 0;

-- Sort by year
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_year_sorted
  ON public.games (year_published DESC NULLS LAST)
  WHERE rating_count > 0;

-- ── Indexes for Recommend Pipeline ───────────────────────────

-- Recommend candidates: rating-based with quality floor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_rating_not_null
  ON public.games (rating DESC NULLS LAST)
  WHERE rating IS NOT NULL AND rating_count >= 5;

-- Player count range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_players
  ON public.games (min_players, max_players)
  WHERE rating IS NOT NULL;

-- ── Stored tsvector Columns ──────────────────────────────────
-- These replace runtime to_tsvector() calls with pre-computed columns.
-- GIN indexes on stored columns are MUCH faster than functional indexes.

-- Name tsvector (for game search)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, ''))) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_name_tsv
  ON public.games USING gin (name_tsv);

-- Description tsvector (eliminates ILIKE '%word%' full scans)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(description, ''))) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_description_tsv
  ON public.games USING gin (description_tsv);

-- ── Updated RPCs ─────────────────────────────────────────────

-- Search by name using stored tsvector (replaces functional index scan)
CREATE OR REPLACE FUNCTION search_games_by_name(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS setof public.games
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM public.games
  WHERE name_tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY ts_rank(name_tsv, websearch_to_tsquery('english', search_query)) DESC
  LIMIT result_limit;
$$;

-- NEW: Search by description using stored tsvector
CREATE OR REPLACE FUNCTION search_games_by_description(
  search_query text,
  result_limit int DEFAULT 30
)
RETURNS TABLE (
  id text, source text, source_id text, name text, description text,
  year_published int, types text[], min_players int, max_players int,
  recommended_players int, min_play_time int, max_play_time int,
  avg_play_time int, complexity real, rating real, rating_count int,
  categories text[], mechanics text[], themes text[],
  platforms text[], thumbnail_url text, image_url text, source_url text
)
LANGUAGE sql STABLE
AS $$
  SELECT g.id, g.source, g.source_id, g.name, g.description,
         g.year_published, g.types, g.min_players, g.max_players,
         g.recommended_players, g.min_play_time, g.max_play_time,
         g.avg_play_time, g.complexity, g.rating, g.rating_count,
         g.categories, g.mechanics, g.themes, g.platforms,
         g.thumbnail_url, g.image_url, g.source_url
  FROM public.games g
  WHERE g.description_tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY g.rating DESC NULLS LAST
  LIMIT result_limit;
$$;
