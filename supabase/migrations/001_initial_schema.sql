-- ============================================================================
-- Recommend a Game — Initial Database Schema
-- ============================================================================
-- Run this in the Supabase SQL Editor to set up the database.
--
-- Tables:
--   games          — Unified game data from all sources (BGG, RAWG, etc.)
--   game_embeddings — Vector embeddings for similarity search (pgvector)
--   user_profiles  — Extended user profile data beyond Supabase Auth
--   user_preferences — What a user is looking for (player count, complexity, etc.)
--   user_game_feedback — Thumbs up/down on recommended games
--   user_favorites — Saved/bookmarked games
-- ============================================================================

-- Enable pgvector for similarity search
create extension if not exists vector with schema public;

-- ============================================================================
-- GAMES
-- ============================================================================

create table public.games (
  -- Primary key: source-prefixed ID (e.g. "bgg-174430", "rawg-3498")
  id text primary key,

  -- Where this game came from
  source text not null check (source in ('bgg', 'rawg', 'igdb', 'local')),

  -- The game's native ID in its source system
  source_id text not null,

  -- Core info
  name text not null,
  description text not null default '',
  year_published integer,

  -- Game classification
  types text[] not null default '{}',  -- e.g. {'board', 'party'}

  -- Player count
  min_players integer,
  max_players integer,
  recommended_players integer,

  -- Play time (minutes)
  min_play_time integer,
  max_play_time integer,
  avg_play_time integer,

  -- Scores (normalized)
  complexity real check (complexity between 1 and 5),  -- 1-5 scale
  rating real check (rating between 0 and 10),         -- 0-10 scale
  rating_count integer default 0,

  -- Tags / metadata (arrays for flexible filtering)
  categories text[] not null default '{}',
  mechanics text[] not null default '{}',
  themes text[] not null default '{}',
  platforms text[] not null default '{}',

  -- Images
  thumbnail_url text,
  image_url text,
  source_url text,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent duplicate imports from the same source
  unique (source, source_id)
);

-- Index for text search on game names
create index idx_games_name on public.games using gin (to_tsvector('english', name));

-- Index for filtering by source
create index idx_games_source on public.games (source);

-- Index for filtering by types
create index idx_games_types on public.games using gin (types);

-- Index for filtering by categories
create index idx_games_categories on public.games using gin (categories);

-- Index for filtering by mechanics
create index idx_games_mechanics on public.games using gin (mechanics);

-- Index for sorting by rating
create index idx_games_rating on public.games (rating desc nulls last);

-- ============================================================================
-- GAME EMBEDDINGS (pgvector)
-- ============================================================================
-- Separate table so we can rebuild embeddings without touching game data.
-- Each game gets a 768-dimensional vector encoding its attributes
-- (categories, mechanics, complexity, player count, etc.)

create table public.game_embeddings (
  game_id text primary key references public.games(id) on delete cascade,
  embedding vector(768) not null,
  model_version text not null default 'v1',  -- track which embedding model generated this
  created_at timestamptz not null default now()
);

-- HNSW index for fast approximate nearest neighbor search
-- cosine distance operator: <=>
create index idx_game_embeddings_vector on public.game_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- USER PROFILES
-- ============================================================================
-- Extends Supabase Auth's built-in auth.users table.

create table public.user_profiles (
  -- References Supabase Auth user ID
  id uuid primary key references auth.users(id) on delete cascade,

  display_name text,
  avatar_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================
-- What a user generally likes. Updated via questionnaire and feedback.

create table public.user_preferences (
  id uuid primary key references auth.users(id) on delete cascade,

  -- Preferred game types
  preferred_types text[] not null default '{}',

  -- Player count they usually play with
  preferred_min_players integer,
  preferred_max_players integer,

  -- How much time they typically have (minutes)
  preferred_min_time integer,
  preferred_max_time integer,

  -- Complexity preference (1-5 scale)
  preferred_complexity_min real default 1,
  preferred_complexity_max real default 5,

  -- Liked/disliked categories and mechanics
  liked_categories text[] not null default '{}',
  disliked_categories text[] not null default '{}',
  liked_mechanics text[] not null default '{}',
  disliked_mechanics text[] not null default '{}',

  -- User preference vector (same 768-dim space as game embeddings)
  -- Updated as user provides feedback
  preference_vector vector(768),

  updated_at timestamptz not null default now()
);

-- ============================================================================
-- USER GAME FEEDBACK
-- ============================================================================
-- Tracks thumbs up/down on recommendations. Feeds into the learning engine.

create table public.user_game_feedback (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,

  -- 1 = thumbs up, -1 = thumbs down
  rating smallint not null check (rating in (-1, 1)),

  -- Context: how was this game surfaced?
  context text,  -- e.g. 'questionnaire', 'search', 'similar_games'

  created_at timestamptz not null default now(),

  -- One feedback per user per game
  unique (user_id, game_id)
);

create index idx_feedback_user on public.user_game_feedback (user_id);
create index idx_feedback_game on public.user_game_feedback (game_id);

-- ============================================================================
-- USER FAVORITES
-- ============================================================================

create table public.user_favorites (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (user_id, game_id)
);

create index idx_favorites_user on public.user_favorites (user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Games are publicly readable
alter table public.games enable row level security;
create policy "Games are publicly readable"
  on public.games for select
  using (true);

-- Game embeddings are publicly readable
alter table public.game_embeddings enable row level security;
create policy "Game embeddings are publicly readable"
  on public.game_embeddings for select
  using (true);

-- User profiles: users can read/write their own
alter table public.user_profiles enable row level security;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- User preferences: users can read/write their own
alter table public.user_preferences enable row level security;
create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = id);
create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = id);
create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = id);

-- User feedback: users can read/write their own
alter table public.user_game_feedback enable row level security;
create policy "Users can read own feedback"
  on public.user_game_feedback for select
  using (auth.uid() = user_id);
create policy "Users can insert own feedback"
  on public.user_game_feedback for insert
  with check (auth.uid() = user_id);
create policy "Users can update own feedback"
  on public.user_game_feedback for update
  using (auth.uid() = user_id);

-- User favorites: users can read/write their own
alter table public.user_favorites enable row level security;
create policy "Users can read own favorites"
  on public.user_favorites for select
  using (auth.uid() = user_id);
create policy "Users can insert own favorites"
  on public.user_favorites for insert
  with check (auth.uid() = user_id);
create policy "Users can delete own favorites"
  on public.user_favorites for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Match games by vector similarity (for recommendations)
create or replace function match_games(
  query_embedding vector(768),
  match_count int default 10,
  similarity_threshold float default 0.5
)
returns table (
  game_id text,
  similarity float
)
language sql stable
as $$
  select
    ge.game_id,
    1 - (ge.embedding <=> query_embedding) as similarity
  from public.game_embeddings ge
  where 1 - (ge.embedding <=> query_embedding) > similarity_threshold
  order by ge.embedding <=> query_embedding
  limit match_count;
$$;

-- Full-text search on game names
create or replace function search_games_by_name(
  search_query text,
  result_limit int default 20
)
returns setof public.games
language sql stable
as $$
  select *
  from public.games
  where to_tsvector('english', name) @@ plainto_tsquery('english', search_query)
  order by ts_rank(to_tsvector('english', name), plainto_tsquery('english', search_query)) desc
  limit result_limit;
$$;

-- Auto-update updated_at timestamps
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_updated_at
  before update on public.games
  for each row execute function update_updated_at();

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function update_updated_at();

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function update_updated_at();
