-- ============================================================
-- Migration 032: Blog Pipeline Run Tracking
-- ============================================================
-- Tracks every pipeline execution for monitoring and debugging.
-- Every cron invocation inserts a row (even failures).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blog_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',  -- 'running', 'success', 'error'
  slot int DEFAULT 0,
  topic_hint text,
  games_fetched int DEFAULT 0,
  quality_score numeric(3,1),
  corrections int DEFAULT 0,
  edits int DEFAULT 0,
  post_slug text,
  post_status text,  -- 'draft', 'rejected', or null if pipeline failed
  email_sent boolean DEFAULT false,
  error_message text,
  duration_ms int
);

-- Index for recent run lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started
  ON public.blog_pipeline_runs (started_at DESC);
