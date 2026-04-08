-- ============================================================
-- Migration 036: Fix function search paths + tighten RLS
-- ============================================================
-- 1. Set search_path = '' on all public functions to prevent
--    search_path hijacking (Supabase lint 0011).
-- 2. Tighten overly permissive RLS policies on llm_parse_cache
--    so only service_role can write (Supabase lint 0024).
-- ============================================================

-- ── 1. Function search paths ──────────────────────────────────

-- Trigger functions (no params)
ALTER FUNCTION public.update_updated_at()
  SET search_path = '';

ALTER FUNCTION public.update_custom_dice_skin_updated_at()
  SET search_path = '';

ALTER FUNCTION public.update_dice_vote_count()
  SET search_path = '';

ALTER FUNCTION public.update_outreach_updated_at()
  SET search_path = '';

-- Search functions
ALTER FUNCTION public.search_games_by_description(text, int)
  SET search_path = '';

ALTER FUNCTION public.search_games_by_name(text, int)
  SET search_path = '';

ALTER FUNCTION public.fuzzy_search_games_by_name(text, int, real)
  SET search_path = '';

-- Vector match functions
ALTER FUNCTION public.match_games(vector(768), int, float)
  SET search_path = '';

ALTER FUNCTION public.match_games_semantic(vector(1536), int, float)
  SET search_path = '';

-- Review stats
ALTER FUNCTION public.get_game_review_stats(text)
  SET search_path = '';

-- ── 2. Tighten llm_parse_cache RLS ───────────────────────────
-- The INSERT/UPDATE policies were WITH CHECK (true), meaning any
-- role (including anon) could write. Cache writes only come from
-- the API server which uses the service_role key (bypasses RLS),
-- so we can drop the permissive policies entirely. Reads stay
-- public since cache hits are non-sensitive.

DROP POLICY IF EXISTS "LLM cache is server-writable" ON public.llm_parse_cache;
DROP POLICY IF EXISTS "LLM cache is server-updatable" ON public.llm_parse_cache;

-- No replacement INSERT/UPDATE policies needed: service_role
-- bypasses RLS, so server writes continue to work. anon and
-- authenticated can no longer write to this table.
