-- Custom dice skins: user-created, shareable, voteable dice designs
-- Migration 012

-- ─── Custom dice skins table ────────────────────────────────────

CREATE TABLE custom_dice_skins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  emoji       text NOT NULL DEFAULT '🎲',
  config      jsonb NOT NULL,
  is_public   boolean NOT NULL DEFAULT false,
  vote_count  integer NOT NULL DEFAULT 0,
  thumbnail_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_custom_dice_skins_user ON custom_dice_skins (user_id);
CREATE INDEX idx_custom_dice_skins_public ON custom_dice_skins (is_public, vote_count DESC)
  WHERE is_public = true;
CREATE INDEX idx_custom_dice_skins_newest ON custom_dice_skins (created_at DESC)
  WHERE is_public = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_custom_dice_skin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_custom_dice_skin_updated_at
  BEFORE UPDATE ON custom_dice_skins
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_dice_skin_updated_at();

-- ─── Custom dice votes table ────────────────────────────────────

CREATE TABLE custom_dice_votes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_id     uuid NOT NULL REFERENCES custom_dice_skins(id) ON DELETE CASCADE,
  UNIQUE (user_id, skin_id)
);

CREATE INDEX idx_custom_dice_votes_skin ON custom_dice_votes (skin_id);

-- Trigger to auto-maintain vote_count on custom_dice_skins
CREATE OR REPLACE FUNCTION update_dice_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE custom_dice_skins SET vote_count = vote_count + 1 WHERE id = NEW.skin_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE custom_dice_skins SET vote_count = vote_count - 1 WHERE id = OLD.skin_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dice_vote_count
  AFTER INSERT OR DELETE ON custom_dice_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_dice_vote_count();

-- ─── Row Level Security ─────────────────────────────────────────

ALTER TABLE custom_dice_skins ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dice_votes ENABLE ROW LEVEL SECURITY;

-- Public skins readable by all (including anon), private only by owner
CREATE POLICY "Public skins are viewable by everyone"
  ON custom_dice_skins FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- Only owner can insert/update/delete their skins
CREATE POLICY "Users can create their own skins"
  ON custom_dice_skins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skins"
  ON custom_dice_skins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own skins"
  ON custom_dice_skins FOR DELETE
  USING (auth.uid() = user_id);

-- Votes: users can see all votes, manage only their own
CREATE POLICY "Votes are viewable by everyone"
  ON custom_dice_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own votes"
  ON custom_dice_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON custom_dice_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Storage bucket for face textures ───────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dice-textures',
  'dice-textures',
  true,
  2097152,  -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their own folder
CREATE POLICY "Users can upload dice textures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dice-textures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view dice textures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dice-textures');

CREATE POLICY "Users can delete their own dice textures"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dice-textures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
