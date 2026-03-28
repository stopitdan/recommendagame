# Automated SEO Blog System

## Goal
Daily auto-generated blog posts targeting long-tail game-related search queries. Purely for SEO traffic, driving users to the recommendation engine and game detail pages (with affiliate links).

## Architecture

```
Cron (daily at 6am UTC)
  -> Generate article via AI API (OpenAI GPT-4o-mini or Claude Haiku)
  -> Store in Supabase `blog_posts` table
  -> Next.js renders at /blog and /blog/[slug]
  -> Sitemap auto-includes new posts
```

## Tech Stack

| Component | Choice | Cost | Notes |
|-----------|--------|------|-------|
| AI generation | OpenAI GPT-4o-mini | ~$0.01-0.05/article | Use personal API key, NOT work account |
| Cron scheduler | Vercel Cron Jobs or GitHub Actions | Free | Triggers the generation script |
| Storage | Supabase table (`blog_posts`) | Free | Already have Supabase |
| Rendering | Next.js dynamic routes | Free | `/blog/[slug]` pages |

## Database Schema (future migration)

```sql
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,        -- meta description for SEO
  content text NOT NULL,    -- markdown body
  tags text[] DEFAULT '{}',
  featured_game_ids text[], -- games mentioned (for internal linking)
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_published ON public.blog_posts (published_at DESC) WHERE published_at IS NOT NULL;
```

## Article Templates

High-value SEO topics to rotate through:

### List Posts (highest traffic)
- "Best [Category] Games for [Player Count] Players ([Year])"
- "Top 10 [Mechanic] Games Under [Time] Minutes"
- "Best [Theme] Board Games You've Never Heard Of"

### Comparison Posts
- "Board Games vs Video Games for [Occasion]"
- "[Game A] vs [Game B]: Which Should You Buy?"

### Guide Posts
- "How to Choose a Board Game for [Occasion]"
- "The Complete Guide to [Genre] Games"
- "What to Play When You're Bored (by Group Size)"

### Seasonal/Trending
- "Best Games for Holiday Gatherings [Year]"
- "New Board Games Released This Month"
- "Games Going Viral on TikTok Right Now"

## Generation Prompt Structure

Each article should:
1. Target a specific long-tail keyword
2. Mention 3-5 games from our database (with links to `/games/[id]`)
3. Include Amazon affiliate links for each game
4. Be 800-1200 words
5. Have a meta description under 160 chars
6. Sound natural, not AI-generated (no emdashes, no corporate speak, conversational tone)

## Implementation Steps

1. [ ] Set up personal OpenAI API account + key
2. [ ] Create Supabase migration for `blog_posts` table
3. [ ] Build generation script (`scripts/generate-blog-post.ts`)
4. [ ] Build `/blog` list page and `/blog/[slug]` detail page
5. [ ] Add blog posts to sitemap
6. [ ] Set up Vercel Cron Job or GitHub Action to run daily
7. [ ] Add blog link to footer navigation
8. [ ] Monitor Search Console for indexed blog pages

## Important Notes

- Use PERSONAL OpenAI/Claude API key, not work credentials
- Articles should reference real games from the database
- Internal links to game detail pages boost SEO for those pages too
- Affiliate links in blog posts = additional revenue channel
- Start with 1 post/day, can scale to 2-3 if traffic warrants it
