-- User-submitted game data corrections
-- Users can flag incorrect data (player count, play time, etc.)
-- Stored as pending until reviewed.

CREATE TABLE IF NOT EXISTS public.game_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  current_value text,
  suggested_value text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.game_corrections(status);
CREATE INDEX IF NOT EXISTS idx_corrections_game ON public.game_corrections(game_id);

-- RLS: users can insert their own corrections, read their own
ALTER TABLE public.game_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert corrections"
  ON public.game_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own corrections"
  ON public.game_corrections FOR SELECT
  USING (auth.uid() = user_id);
