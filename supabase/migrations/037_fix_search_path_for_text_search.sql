-- ============================================================
-- Migration 037: Fix search_path for text-search functions
-- ============================================================
-- Migration 036 set search_path = '' on all public functions to
-- satisfy Supabase lint 0011. However, functions that use
-- websearch_to_tsquery / ts_rank / word_similarity need
-- pg_catalog (built-in text search configs) and public (tables)
-- on the path. Without them the 'english' config can't resolve
-- and searches silently return zero rows.
-- ============================================================

ALTER FUNCTION public.search_games_by_name(text, int)
  SET search_path = 'public, pg_catalog';

ALTER FUNCTION public.search_games_by_description(text, int)
  SET search_path = 'public, pg_catalog';

ALTER FUNCTION public.fuzzy_search_games_by_name(text, int, real)
  SET search_path = 'public, pg_catalog';
