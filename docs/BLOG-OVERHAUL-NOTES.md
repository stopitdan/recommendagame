# Blog Ecosystem Overhaul -- Implementation Notes

> Last updated: 2026-04-07
> Status: **DEPLOYED AND RUNNING** -- monitoring for 1-2 days before next iteration

---

## Current System Architecture (Post-Overhaul)

```
Vercel Cron (2x daily)
  slot=0 @ 6 AM UTC
  slot=1 @ 6 PM UTC
    |
    v
/api/blog/generate?slot=N
    |
    v
Insert blog_pipeline_runs row (status: 'running')
    |
    v
pickTopic(slot) -- (dayOfYear * 2 + slot) % 710 topics
    |   710 templates across 29 categories
    |   6 post formats: list, comparison, guide, opinion, deep-dive, buying-guide
    |
    v
Fetch recent 15 published posts (for internal linking)
    |
    v
fetchTopicGames() -- Supabase query
    |   Source filter: bgg-only for board game topics, all sources for crossover
    |   Topic-aware constraints: solo, 2-player, party, quick parsed from title
    |
    v
generateDraft() -- gpt-4.1 (full model), temp 0.6, max 6000 tokens
    |   Format-aware prompt (different structure per format type)
    |   Game-type alignment rules in prompt
    |   Keyword density: exact phrase 3-4x + 2-3 variations
    |   Internal links to recent posts + /find-a-game + /browse
    |   Amazon affiliate links for each featured game
    |   1-2 external authority links (BGG, publishers, Wikipedia)
    |
    v
factCheck(allowVideoGames) -- 4 checks:
    |   0. Game-type alignment (board vs video, code)
    |   1. Database accuracy (player count, time, complexity, code)
    |   2. Content-claim verification (gpt-4.1-mini)
    |   3. Apply corrections (gpt-4.1-mini)
    |
    v
editDraft() -- 3 edits:
    |   1. Structure & SEO: word count, H2s, CTA links, affiliate links (gpt-4.1-mini)
    |   2. Tone & Voice: 44 AI phrases + 8 cringey phrases + paragraph starts (gpt-4.1-mini)
    |   3. Mechanical cleanup: em-dashes, en-dashes, double hyphens, exclamation marks (code)
    |
    v
processImages() -- inject game box art
    |   Supports BGG, RAWG, and IGDB image URLs
    |   Validates via HEAD request, deduplicates
    |   Injected after H2 headers mentioning game name
    |   Display: max-width 420px, rounded corners, shadow
    |
    v
evaluateQuality() -- gpt-4.1-mini, 5 dimensions (0-10 each)
    |   Accuracy, Readability, Tone, SEO, Completeness
    |   Pass threshold: >= 6.0 average
    |
    v
Save to blog_posts (status: 'draft' if passed, 'rejected' if failed)
    |
    v
Update blog_pipeline_runs (status, quality, duration, metrics)
    |
    v
Email via Resend (isolated try/catch, only for drafts)
    |   From: blog@boredgame.lol -> To: contact@boredgame.lol
    |   Includes: quality scores, fact-check corrections, edits, preview link
    |   One-click Approve / Reject buttons
    |
    v
Admin clicks Approve -> published_at = now(), status = 'published'
    |
    v
Blog list API: filters published_at <= now() AND status = 'published'
```

---

## Key Files

| File | Purpose |
|------|---------|
| `vercel.json` | 2 cron entries (slot=0 at 6AM, slot=1 at 6PM UTC) |
| `src/lib/llm/models.ts` | Model config: blog=gpt-4.1, blogAnalysis=gpt-4.1-mini |
| `src/lib/blog/types.ts` | Pipeline types, TopicTemplate (format, allowVideoGames) |
| `src/lib/blog/topic-picker.ts` | 710 topics, slot-aware pickTopic() |
| `src/lib/blog/game-fetcher.ts` | Topic-aware game queries (player count, time, source) |
| `src/lib/blog/generator.ts` | Format-aware LLM prompt, internal linking, affiliate links |
| `src/lib/blog/fact-checker.ts` | 4-check system (game-type alignment + DB + LLM verify + LLM fix) |
| `src/lib/blog/editor.ts` | 3-edit system (structure + tone + mechanical) |
| `src/lib/blog/image-processor.ts` | Multi-source image injection (BGG, RAWG, IGDB) |
| `src/lib/blog/quality-evaluator.ts` | 5-dimension scoring, pass >= 6.0 |
| `src/lib/blog/pipeline.ts` | Orchestrates all 8 stages |
| `src/app/api/blog/generate/route.ts` | Cron endpoint, pipeline run tracking, email sending |
| `src/app/api/blog/approve/route.ts` | One-click approve/reject from email |
| `src/app/api/blog/preview/route.ts` | Token-protected draft preview (HTML) |
| `src/app/api/blog/route.ts` | Public blog list (filtered: published_at <= now) |
| `src/app/api/blog/[slug]/route.ts` | Single post API (same filter) |
| `src/app/blog/[slug]/BlogPostView.tsx` | Blog post renderer (images at 420px max) |
| `src/lib/affiliate-config.ts` | Centralized affiliate tags (Amazon active, Target/Walmart pending) |
| `src/components/BuyOptions.tsx` | Game page buy links (uses affiliate-config) |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `blog_posts` | All posts (draft/published/rejected). RLS: public sees only published + past-dated |
| `blog_pipeline_runs` | Tracks every pipeline execution (status, quality, duration, errors) |

**Key migrations:**
- `018_blog_posts.sql` -- Original blog table
- `027_blog_draft_approval.sql` -- Added approval_token + status columns
- `031_blog_future_date_filter.sql` -- RLS policy: published_at <= now()
- `032_blog_pipeline_runs.sql` -- Pipeline monitoring table

---

## Cost

~$0.05/post (gpt-4.1 generation + gpt-4.1-mini for 5-6 analysis calls). At 2 posts/day = ~$3/month.

---

## Monitoring

After each cron run, check:
1. **Vercel Logs** -- filter for `[Blog Generate]` to see cron hits, pipeline results
2. **Supabase `blog_pipeline_runs`** -- every run logged with status, quality score, duration, error messages
3. **Resend dashboard** -- email delivery status
4. **Blog list** (`/blog`) -- new posts should appear after approval

---

## What's Working (as of 2026-04-07)

- Pipeline runs successfully via manual trigger
- Approval emails send correctly via Resend
- Preview page renders with properly sized images (420px max)
- Draft/approve/reject flow works end-to-end
- Quality scoring with gpt-4.1-mini is more discerning than nano was
- Format-aware prompts produce varied content (not just lists)
- Cron schedule deployed: 6 AM + 6 PM UTC

---

## Pending / Next Session

### Waiting on external approvals
- [ ] **Target affiliate** -- application submitted via Impact.com, processing
- [ ] **Walmart affiliate** -- application submitted via Impact.com, processing
- [ ] **Google AdSense** -- verification still pending (script is live, just slow for low-traffic sites)
- [ ] **GameNerdz affiliate** -- not yet contacted

### After 1-2 days of monitoring
- [ ] Review `blog_pipeline_runs` table for failure patterns
- [ ] Check quality scores -- if most posts score 6-7, threshold is right. If most score 8+, consider raising to 7.0
- [ ] Review 2-3 published posts for actual content quality, keyword density, link correctness
- [ ] Check if approval emails are arriving consistently at both 6 AM and 6 PM UTC slots
- [ ] Verify no duplicate topics are being picked (different slots = different topics)

### Potential improvements for next iteration
- [ ] Auto-publish high-quality posts (score >= 8.0) without email approval
- [ ] Add "request changes" flow to approval email (not just approve/reject)
- [ ] Blog sitemap -- add published blog posts to sitemap.xml for faster Google indexing
- [ ] Increase topic pool further (currently 710, could go to 1000+)
- [ ] Add hero images / header images to blog posts (not just game box art)
- [ ] Track affiliate click-through rates to see which posts generate revenue
- [ ] A/B test blog post titles for CTR optimization
- [ ] Once Target/Walmart approved, update `src/lib/affiliate-config.ts` with tags and add multi-retailer links to generator prompt

---

## Changes Log (2026-04-07 Session)

### Phase 1: Critical Fixes
- **1A: Future-dated posts** -- Added `.lte('published_at', now())` to 3 API routes + RLS migration
- **1B-C: Logging + email isolation** -- Entry log in generate route, email wrapped in isolated try/catch

### Phase 2: Quality Upgrade
- **2A: Models** -- blog: gpt-4.1-mini -> gpt-4.1, blogAnalysis: gpt-4.1-nano -> gpt-4.1-mini
- **2B: Threshold** -- Quality pass threshold 5.0 -> 6.0
- **2C: Prompt** -- Format-aware (6 types), stronger keywords, game-type rules, internal linking
- **2D: Fact-checker** -- Game-type alignment pre-check using `allowVideoGames` flag
- **2E: Game-fetcher** -- Topic-aware player count/time filters, `allowVideoGames` param
- **2F: Internal linking** -- Pipeline queries recent 15 posts, passes to generator

### Phase 3: Scale
- **3A-C: 2x daily** -- Slot-based topic picker, vercel.json with 2 cron entries
- **3D: Topic expansion** -- 365 -> 710 templates with 14 new format categories
- **3E: Images** -- Processor supports RAWG/IGDB URLs, display at 420px max-width

### Phase 4: Monitoring
- **Pipeline run tracking** -- `blog_pipeline_runs` table, generate route records every run

### Phase 5: Affiliates
- **Config file** -- `src/lib/affiliate-config.ts` centralizes all affiliate tags
- **BuyOptions** -- Updated to use centralized config
- **Applications** -- Target + Walmart submitted, pending approval

### Phase 6: Testing
- **32 new tests** -- topic-picker, editor, fact-checker (all pure-code, no LLM mocking)
- **Full suite** -- 475/477 pass (2 pre-existing failures unrelated to blog)
