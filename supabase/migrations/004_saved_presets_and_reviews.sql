-- ============================================================================
-- Migration 004: Saved Preference Presets & User Reviews
-- ============================================================================

-- Saved preference presets — named sets of questionnaire answers
create table if not exists public.user_saved_presets (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_presets_user on public.user_saved_presets (user_id);

-- RLS for presets
alter table public.user_saved_presets enable row level security;
create policy "Users can read own presets"
  on public.user_saved_presets for select using (auth.uid() = user_id);
create policy "Users can insert own presets"
  on public.user_saved_presets for insert with check (auth.uid() = user_id);
create policy "Users can update own presets"
  on public.user_saved_presets for update using (auth.uid() = user_id);
create policy "Users can delete own presets"
  on public.user_saved_presets for delete using (auth.uid() = user_id);

-- User reviews — 1-10 rating + optional text review
create table if not exists public.user_reviews (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, game_id)
);

create index if not exists idx_reviews_user on public.user_reviews (user_id);
create index if not exists idx_reviews_game on public.user_reviews (game_id);
create index if not exists idx_reviews_rating on public.user_reviews (rating desc);

-- RLS for reviews — public read, own write
alter table public.user_reviews enable row level security;
create policy "Reviews are publicly readable"
  on public.user_reviews for select using (true);
create policy "Users can insert own reviews"
  on public.user_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own reviews"
  on public.user_reviews for update using (auth.uid() = user_id);
create policy "Users can delete own reviews"
  on public.user_reviews for delete using (auth.uid() = user_id);

-- Recommendation settings on user_preferences
alter table public.user_preferences
  add column if not exists popularity_mode text not null default 'popular'
    check (popularity_mode in ('popular', 'any', 'hidden-gems')),
  add column if not exists min_rating real default 0,
  add column if not exists excluded_sources text[] not null default '{}';

-- Auto-update timestamps
create trigger presets_updated_at
  before update on public.user_saved_presets
  for each row execute function update_updated_at();

create trigger reviews_updated_at
  before update on public.user_reviews
  for each row execute function update_updated_at();

-- Aggregate function: average user review rating per game
create or replace function get_game_review_stats(target_game_id text)
returns table (
  avg_rating real,
  review_count bigint
)
language sql stable
as $$
  select
    avg(rating)::real as avg_rating,
    count(*) as review_count
  from public.user_reviews
  where game_id = target_game_id;
$$;
