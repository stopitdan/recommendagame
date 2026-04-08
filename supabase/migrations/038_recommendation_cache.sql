-- Semantic recommendation cache
--
-- Stores full recommendation results keyed by a canonical hash of the
-- parsed preferences. This means "deck building for 2" and "2 player
-- deck builders" produce the same key after LLM parsing, so the second
-- user gets an instant cache hit.
--
-- Two-tier: Redis (10 min, fast) + this table (persistent, 24hr staleness).

CREATE TABLE IF NOT EXISTS public.recommendation_cache (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  canonical_key_hash text NOT NULL UNIQUE,
  preferences_summary jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  result_count int NOT NULL DEFAULT 0,
  hit_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_cache_updated
  ON public.recommendation_cache (updated_at DESC);

-- RLS: allow server-side read/write (service role or anon for now)
ALTER TABLE public.recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_cache_select" ON public.recommendation_cache
  FOR SELECT USING (true);

CREATE POLICY "rec_cache_insert" ON public.recommendation_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rec_cache_update" ON public.recommendation_cache
  FOR UPDATE USING (true);
