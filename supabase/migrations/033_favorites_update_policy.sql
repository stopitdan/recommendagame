-- Fix: user_favorites was missing an UPDATE policy, causing RLS violations
-- when toggling favorites or updating metadata on existing favorites.

CREATE POLICY "Users can update their own favorites"
  ON user_favorites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
