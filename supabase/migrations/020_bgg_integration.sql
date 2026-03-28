-- ============================================================
-- Migration 020: BGG Account Integration
-- ============================================================
-- Allows users to link their BoardGameGeek account and import
-- their collection, ratings, and play data for personalized
-- recommendations.
-- ============================================================

-- Add BGG username to user profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bgg_username text,
  ADD COLUMN IF NOT EXISTS bgg_synced_at timestamptz;

-- User's imported BGG collection
CREATE TABLE IF NOT EXISTS public.user_bgg_collection (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bgg_id text NOT NULL,
  game_id text REFERENCES public.games(id) ON DELETE SET NULL,
  name text NOT NULL,
  bgg_rating real,
  owned boolean NOT NULL DEFAULT false,
  wishlisted boolean NOT NULL DEFAULT false,
  play_count integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bgg_id)
);

CREATE INDEX IF NOT EXISTS idx_bgg_collection_user
  ON public.user_bgg_collection (user_id);
CREATE INDEX IF NOT EXISTS idx_bgg_collection_game
  ON public.user_bgg_collection (game_id)
  WHERE game_id IS NOT NULL;

-- RLS
ALTER TABLE public.user_bgg_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own BGG collection"
  ON public.user_bgg_collection FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages BGG collections"
  ON public.user_bgg_collection FOR ALL
  USING (auth.role() = 'service_role');
