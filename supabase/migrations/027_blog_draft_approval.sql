-- ============================================================
-- Migration 027: Blog Draft Approval Workflow
-- ============================================================
-- Adds approval token and status tracking so blog posts are
-- generated as drafts, emailed for review, and only published
-- when explicitly approved via a unique token link.
-- ============================================================

-- Unique token for approval links (emailed to admin)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS approval_token uuid DEFAULT gen_random_uuid();

-- Track draft vs published status explicitly
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

-- New drafts will default to 'draft'; existing posts stay 'published'
-- Valid values: 'draft', 'published', 'rejected'

-- Index for fast token lookup during approval
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_approval_token
  ON blog_posts (approval_token)
  WHERE approval_token IS NOT NULL;

-- Update RLS: only show published posts publicly (already filtered by published_at,
-- but now also check status for extra safety)
DROP POLICY IF EXISTS "Published posts are public" ON blog_posts;
CREATE POLICY "Published posts are public"
  ON blog_posts FOR SELECT
  USING (published_at IS NOT NULL AND status = 'published');
