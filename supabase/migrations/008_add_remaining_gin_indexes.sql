-- ============================================================================
-- Migration 008: Add GIN indexes on remaining filterable array columns
-- ============================================================================

create index if not exists idx_games_designers on public.games using gin (designers);
create index if not exists idx_games_publishers on public.games using gin (publishers);
create index if not exists idx_games_developers on public.games using gin (developers);
