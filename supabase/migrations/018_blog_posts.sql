-- ============================================================
-- Migration 018: Blog Posts
-- ============================================================
-- Auto-generated SEO blog posts. Public read, service-role write.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  featured_game_ids text[] DEFAULT '{}',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_published
  ON public.blog_posts (published_at DESC)
  WHERE published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_slug
  ON public.blog_posts (slug);

-- RLS: anyone can read published posts, only service role can write
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are public"
  ON public.blog_posts FOR SELECT
  USING (published_at IS NOT NULL);

CREATE POLICY "Service role manages posts"
  ON public.blog_posts FOR ALL
  USING (auth.role() = 'service_role');
