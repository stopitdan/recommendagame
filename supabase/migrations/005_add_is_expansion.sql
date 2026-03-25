-- ============================================================================
-- Migration 005: Add is_expansion flag and parent_game_id
-- ============================================================================
-- Tracks whether a game is an expansion and what base game it expands.
-- Expansions are included in the games table (not separate) so they
-- can be recommended alongside base games.

alter table public.games add column if not exists is_expansion boolean not null default false;
alter table public.games add column if not exists parent_game_id text;

create index if not exists idx_games_is_expansion on public.games (is_expansion);
create index if not exists idx_games_parent_game on public.games (parent_game_id) where parent_game_id is not null;
