-- ============================================================================
-- Migration 007: Add GIN indexes on themes and platforms arrays
-- ============================================================================
-- The browse page filters by themes and platforms using array containment
-- queries (contains/overlaps). Without a GIN index, Postgres does a full
-- table scan which times out on the free tier with 100k+ rows.

create index if not exists idx_games_themes on public.games using gin (themes);
create index if not exists idx_games_platforms on public.games using gin (platforms);
