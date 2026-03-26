-- ============================================================================
-- Migration 009: Achievement System
-- ============================================================================

create table if not exists public.user_achievements (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),

  unique (user_id, achievement_id)
);

create index if not exists idx_achievements_user on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;
create policy "Users can read own achievements"
  on public.user_achievements for select using (auth.uid() = user_id);
create policy "Users can insert own achievements"
  on public.user_achievements for insert with check (auth.uid() = user_id);
