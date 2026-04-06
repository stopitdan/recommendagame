-- Add structured metadata columns to outreach_tasks for filtering and at-a-glance info

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS cost_type text NOT NULL DEFAULT 'unknown'
  CHECK (cost_type IN ('free', 'paid', 'freemium', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS cost_amount text;

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS can_post_immediately text NOT NULL DEFAULT 'unknown'
  CHECK (can_post_immediately IN ('yes', 'no', 'needs_karma', 'needs_approval', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS maintenance_level text NOT NULL DEFAULT 'unknown'
  CHECK (maintenance_level IN ('one_and_done', 'low', 'moderate', 'high', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS link_type text NOT NULL DEFAULT 'unknown'
  CHECK (link_type IN ('do_follow', 'no_follow', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS approval_process text NOT NULL DEFAULT 'unknown'
  CHECK (approval_process IN ('auto_published', 'manual_review', 'community_moderated', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS estimated_reach text NOT NULL DEFAULT 'unknown'
  CHECK (estimated_reach IN ('low', 'medium', 'high', 'very_high', 'unknown'));

ALTER TABLE outreach_tasks ADD COLUMN IF NOT EXISTS time_to_live text NOT NULL DEFAULT 'unknown'
  CHECK (time_to_live IN ('immediate', 'hours', 'days', 'weeks', 'unknown'));
