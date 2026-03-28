-- ============================================================
-- Migration 016: Newsletter Subscribers
-- ============================================================
-- Simple email collection table for newsletter signups.
-- No auth required — anyone can subscribe.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

-- Allow anyone to insert (subscribe)
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Only service role can read/update/delete (for admin/export)
CREATE POLICY "Service role can manage subscribers"
  ON public.newsletter_subscribers FOR ALL
  USING (auth.role() = 'service_role');
