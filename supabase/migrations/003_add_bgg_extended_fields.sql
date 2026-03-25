-- ============================================================================
-- Migration 003: Add BGG-specific extended fields
-- ============================================================================
-- Captures all the rich data from the BGG Kaggle dataset that our
-- original schema didn't account for.

-- Bayes-weighted average rating (accounts for number of ratings)
alter table public.games add column if not exists bayes_avg_rating real;

-- Standard deviation of ratings
alter table public.games add column if not exists rating_stddev real;

-- Community age recommendation (e.g. 14.5 = ~14 years old)
alter table public.games add column if not exists community_age_rec real;

-- Manufacturer recommended age
alter table public.games add column if not exists mfg_age_rec integer;

-- Language ease (1-5 scale, how much language matters)
alter table public.games add column if not exists language_ease real;

-- Best player count (community voted, e.g. "4" or "3,4")
alter table public.games add column if not exists best_players text;

-- Good player counts (community voted, array)
alter table public.games add column if not exists good_players text[];

-- Community play time (min/max as voted by community, vs manufacturer stated)
alter table public.games add column if not exists community_min_playtime integer;
alter table public.games add column if not exists community_max_playtime integer;

-- Ownership/interest signals
alter table public.games add column if not exists num_owned integer;
alter table public.games add column if not exists num_want integer;
alter table public.games add column if not exists num_wish integer;
alter table public.games add column if not exists num_comments integer;

-- Expansion/version info
alter table public.games add column if not exists num_expansions integer;
alter table public.games add column if not exists is_reimplementation boolean default false;

-- Family (game series, e.g. "Catan", "Ticket to Ride")
alter table public.games add column if not exists family text;

-- Kickstarter flag
alter table public.games add column if not exists kickstarted boolean default false;

-- BGG rankings by category
alter table public.games add column if not exists rank_overall integer;
alter table public.games add column if not exists rank_strategy integer;
alter table public.games add column if not exists rank_family integer;
alter table public.games add column if not exists rank_party integer;
alter table public.games add column if not exists rank_abstract integer;
alter table public.games add column if not exists rank_thematic integer;
alter table public.games add column if not exists rank_wargame integer;
alter table public.games add column if not exists rank_cgs integer;
alter table public.games add column if not exists rank_childrens integer;

-- Designers and artists (arrays)
alter table public.games add column if not exists designers text[] not null default '{}';
alter table public.games add column if not exists artists text[] not null default '{}';

-- Indexes for commonly queried new columns
create index if not exists idx_games_num_owned on public.games (num_owned desc nulls last);
create index if not exists idx_games_rank_overall on public.games (rank_overall asc nulls last);
create index if not exists idx_games_bayes_avg on public.games (bayes_avg_rating desc nulls last);
