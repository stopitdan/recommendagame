-- ============================================================
-- Migration 022: User Owned Games
-- ============================================================
-- Canonical "I own this game" table, separate from favorites.
-- Populated by BGG sync (source='bgg') and manual adds (source='manual').
-- Used by the "My Collection Only" recommendation filter.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_owned_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_owned_games_user ON public.user_owned_games (user_id);
CREATE INDEX IF NOT EXISTS idx_owned_games_game ON public.user_owned_games (game_id);

ALTER TABLE public.user_owned_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collection"
  ON public.user_owned_games FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages owned games"
  ON public.user_owned_games FOR ALL
  USING (auth.role() = 'service_role');
