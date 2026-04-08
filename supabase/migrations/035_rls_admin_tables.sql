-- ============================================================
-- Migration 035: Enable RLS on admin/backend-only tables
-- ============================================================
-- Three tables were missing RLS: blog_pipeline_runs,
-- outreach_tasks, and daily_site_stats. All are backend-only
-- (written by cron jobs / service role), so no user-facing
-- policies are needed. Enabling RLS with no policies means
-- only the service_role key can access them, which is correct.
-- ============================================================

-- blog_pipeline_runs: written by blog cron, read by admin debug
ALTER TABLE public.blog_pipeline_runs ENABLE ROW LEVEL SECURITY;

-- outreach_tasks: managed via admin UI using service role
ALTER TABLE public.outreach_tasks ENABLE ROW LEVEL SECURITY;

-- daily_site_stats: populated by cron, read by admin reports
ALTER TABLE public.daily_site_stats ENABLE ROW LEVEL SECURITY;
