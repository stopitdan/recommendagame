-- ============================================================
-- Migration 031: Blog Future Date Filter
-- ============================================================
-- Prevent future-dated blog posts from being publicly visible.
-- Belt-and-suspenders with the app-level .lte() filter.
-- ============================================================

DROP POLICY IF EXISTS "Published posts are public" ON blog_posts;
CREATE POLICY "Published posts are public"
  ON blog_posts FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= now() AND status = 'published');
