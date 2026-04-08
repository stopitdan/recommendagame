-- Implicit signal collection: tracks user behavior beyond explicit thumbs up/down.
-- Captures result clicks, dwell time, scroll depth, and search patterns.
-- Used for collaborative filtering enrichment and automated site reports.

CREATE TABLE IF NOT EXISTS user_implicit_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  event_type text NOT NULL,  -- 'result_click', 'dwell', 'scroll_depth', 'search', 'share', 'favorite_toggle'
  game_id text,              -- nullable (not all events are game-specific)
  payload jsonb DEFAULT '{}',-- flexible: { dwell_ms, scroll_pct, query, position, source }
  created_at timestamptz DEFAULT now()
);

-- Index for per-user signal queries (collaborative filtering)
CREATE INDEX idx_implicit_signals_user ON user_implicit_signals (user_id, event_type);

-- Index for time-range aggregation queries (daily reports)
CREATE INDEX idx_implicit_signals_created ON user_implicit_signals (created_at);

-- Index for game-level engagement metrics
CREATE INDEX idx_implicit_signals_game ON user_implicit_signals (game_id, event_type) WHERE game_id IS NOT NULL;

-- RLS: users can insert their own signals, service role reads all
ALTER TABLE user_implicit_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own signals"
  ON user_implicit_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own signals"
  ON user_implicit_signals FOR SELECT
  USING (auth.uid() = user_id);

-- Aggregated daily stats table for reports (populated by cron)
CREATE TABLE IF NOT EXISTS daily_site_stats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date date NOT NULL UNIQUE,
  total_searches integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  result_clicks integer DEFAULT 0,
  avg_dwell_ms integer DEFAULT 0,
  avg_scroll_pct numeric(5,2) DEFAULT 0,
  top_searched_terms jsonb DEFAULT '[]',
  top_clicked_games jsonb DEFAULT '[]',
  new_signups integer DEFAULT 0,
  feedback_given integer DEFAULT 0,
  blog_views integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_stats_date ON daily_site_stats (date DESC);
