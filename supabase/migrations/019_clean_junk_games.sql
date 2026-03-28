-- ============================================================
-- Migration 019: Clean Junk Games
-- ============================================================
-- Remove fictional, joke, and low-quality entries that pollute
-- recommendation results.
-- ============================================================

-- Delete fictional/joke games
DELETE FROM public.games WHERE LOWER(name) LIKE '%cones of dunshire%';

-- Delete fan expansions and unofficial content
DELETE FROM public.games WHERE LOWER(name) LIKE '%fan expansion%';
DELETE FROM public.games WHERE LOWER(name) LIKE '%(fan)%';
DELETE FROM public.games WHERE LOWER(name) LIKE '%unofficial%';

-- Delete games with extremely low engagement (fewer than 5 ratings)
-- that also have low ratings (below 5.0) — these are noise
DELETE FROM public.games
WHERE rating IS NOT NULL
  AND rating < 5.0
  AND rating_count < 5;

-- Update stats
ANALYZE public.games;
