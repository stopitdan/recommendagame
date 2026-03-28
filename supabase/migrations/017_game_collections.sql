-- ============================================================
-- Migration 017: Game Collections / Lists
-- ============================================================
-- Users can create named collections of games and optionally
-- make them public for others to browse and share.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.game_collections(id) ON DELETE CASCADE,
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (collection_id, game_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_user ON public.game_collections (user_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON public.game_collections (is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON public.game_collection_items (collection_id);

-- RLS
ALTER TABLE public.game_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_collection_items ENABLE ROW LEVEL SECURITY;

-- Collections: owners can CRUD, anyone can view public
CREATE POLICY "Users manage own collections"
  ON public.game_collections FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Public collections are viewable"
  ON public.game_collections FOR SELECT
  USING (is_public = true);

-- Items: owners can CRUD via collection ownership, anyone can view public collection items
CREATE POLICY "Users manage own collection items"
  ON public.game_collection_items FOR ALL
  USING (collection_id IN (SELECT id FROM public.game_collections WHERE user_id = auth.uid()));

CREATE POLICY "Public collection items are viewable"
  ON public.game_collection_items FOR SELECT
  USING (collection_id IN (SELECT id FROM public.game_collections WHERE is_public = true));

-- Auto-update timestamp
CREATE TRIGGER update_collection_timestamp
  BEFORE UPDATE ON public.game_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
