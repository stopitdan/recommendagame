-- 2D map positions computed via UMAP dimensionality reduction on game embeddings.
-- Used by the interactive game map visualization.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS map_x real,
  ADD COLUMN IF NOT EXISTS map_y real,
  ADD COLUMN IF NOT EXISTS map_cluster_id smallint;

CREATE INDEX IF NOT EXISTS idx_games_map_position
  ON public.games (map_x, map_y)
  WHERE map_x IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_map_cluster
  ON public.games (map_cluster_id)
  WHERE map_cluster_id IS NOT NULL;
