-- ============================================================================
-- Fuzzy Search with pg_trgm
-- ============================================================================
-- Adds typo-tolerant search so "Bertrayal" finds "Betrayal".
--
-- How it works:
--   pg_trgm breaks strings into 3-character chunks and compares overlap.
--   A GIN trigram index on game names makes similarity queries fast on 178k+ rows.
--   The new fuzzy_search_games_by_name() RPC is used as a fallback when the
--   exact tsvector search returns zero results.
-- ============================================================================

-- Enable the trigram extension (built into Supabase/PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on game names for fast fuzzy matching
-- Note: CONCURRENTLY removed because Supabase SQL Editor runs in a transaction.
-- If running via psql directly, add CONCURRENTLY back to avoid table locks.
CREATE INDEX IF NOT EXISTS idx_games_name_trgm
  ON public.games USING gin (name gin_trgm_ops);

-- Fuzzy search RPC: returns games ranked by trigram similarity to the query.
-- Uses word_similarity() which checks if any word in the name is similar,
-- making it more forgiving than whole-string similarity().
-- Threshold of 0.25 catches common typos without returning too much noise.
CREATE OR REPLACE FUNCTION fuzzy_search_games_by_name(
  search_query text,
  result_limit int DEFAULT 20,
  similarity_floor real DEFAULT 0.25
)
RETURNS TABLE (
  id text,
  source text,
  source_id text,
  name text,
  description text,
  year_published int,
  types text[],
  min_players int,
  max_players int,
  recommended_players int,
  min_play_time int,
  max_play_time int,
  avg_play_time int,
  complexity real,
  rating real,
  rating_count int,
  categories text[],
  mechanics text[],
  themes text[],
  platforms text[],
  thumbnail_url text,
  image_url text,
  source_url text,
  similarity_score real
)
LANGUAGE sql STABLE
AS $$
  SELECT
    g.id, g.source, g.source_id, g.name, g.description,
    g.year_published, g.types, g.min_players, g.max_players,
    g.recommended_players, g.min_play_time, g.max_play_time,
    g.avg_play_time, g.complexity, g.rating, g.rating_count,
    g.categories, g.mechanics, g.themes, g.platforms,
    g.thumbnail_url, g.image_url, g.source_url,
    word_similarity(search_query, g.name) AS similarity_score
  FROM public.games g
  WHERE word_similarity(search_query, g.name) >= similarity_floor
  ORDER BY word_similarity(search_query, g.name) DESC, g.rating DESC NULLS LAST
  LIMIT result_limit;
$$;
