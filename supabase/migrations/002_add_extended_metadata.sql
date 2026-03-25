-- ============================================================================
-- Migration 002: Add extended metadata columns
-- ============================================================================
-- Captures additional data from RAWG and future sources that doesn't
-- fit into the original schema.

-- Metacritic score (0-100 scale, from RAWG)
alter table public.games add column if not exists metacritic integer;

-- ESRB rating (e.g. "Everyone", "Teen", "Mature")
alter table public.games add column if not exists esrb_rating text;

-- Developers and publishers (arrays of names)
alter table public.games add column if not exists developers text[] not null default '{}';
alter table public.games add column if not exists publishers text[] not null default '{}';

-- Community engagement signals (useful for recommendation weighting)
alter table public.games add column if not exists added_count integer;
alter table public.games add column if not exists suggestions_count integer;

-- Index for metacritic sorting
create index if not exists idx_games_metacritic on public.games (metacritic desc nulls last);
