# Blog Ecosystem Overhaul -- Implementation Notes

> Session: 2026-04-07
> Goal: Transform the automated blog system into a high-quality, 2x/day SEO content machine.

---

## Changes Log

### Phase 1A: Fix Future-Dated Blog Posts

**Problem:** `scripts/seed-blog-posts.ts` seeded posts with `published_at` through 2026-04-15 (future dates). The blog list API and single-post API only checked `published_at IS NOT NULL`, never `published_at <= now()`. Users could see posts dated a week in the future.

**Files changed:**
- `src/app/api/blog/route.ts` -- Added `.lte('published_at', new Date().toISOString())` filter
- `src/app/api/blog/[slug]/route.ts` -- Same filter
- `src/app/blog/[slug]/page.tsx` -- Same filter in `generateMetadata`
- `supabase/migrations/031_blog_future_date_filter.sql` -- Updated RLS policy to enforce `published_at <= now()` at the database level

**Why belt-and-suspenders:** The app-level filter handles the API response. The RLS policy is a safety net in case any other query path (direct Supabase client, future endpoints) also needs to respect this rule.

---

### Phase 1B-C: Resilient Logging + Email Error Isolation

**Problem:** If `resend.emails.send()` threw an error, the entire generate handler caught it at the outer level and returned a 500 -- making it look like the pipeline failed when the post was actually saved successfully. Also, no logging at the start of the handler to confirm the cron was even hitting the endpoint.

**Files changed:**
- `src/app/api/blog/generate/route.ts` -- Added entry log, wrapped email block in dedicated try/catch, added `emailSent` flag to response

---

### Phase 2A: Model Upgrade

**Previous:** `blog: 'gpt-4.1-mini'`, `blogAnalysis: 'gpt-4.1-nano'`
**New:** `blog: 'gpt-4.1'`, `blogAnalysis: 'gpt-4.1-mini'`

**Cost analysis:** ~$0.05/post total (generation + 5-6 analysis calls). At 2 posts/day = ~$3/month. The quality difference between mini and full gpt-4.1 for long-form writing is substantial.

**File changed:** `src/lib/llm/models.ts`

Also increased `max_tokens` from 4000 to 6000 in `src/lib/blog/generator.ts` to allow richer content from the more capable model.

---

### Phase 2B: Quality Threshold

**Previous:** Pass threshold 5.0/10
**New:** Pass threshold 6.0/10

**Rationale:** With gpt-4.1-mini doing evaluation (instead of nano), scores are more accurate. 5.0 with nano passed nearly everything. 6.0 is moderate -- filters out bad posts without being so aggressive that most get rejected before we calibrate.

**File changed:** `src/lib/blog/quality-evaluator.ts`

---

### Phase 2C: Generator Prompt Enhancements

**File changed:** `src/lib/blog/generator.ts` -- `buildPrompt()` function

**Key changes:**
1. Format-aware writing instructions based on topic template's `format` field
2. Explicit game-type alignment instruction (check `source` field)
3. Stronger keyword instructions (exact phrase 3-4x, 2-3 close variations)
4. Recent blog post list for genuine internal linking
5. Removed redundant "no emdashes" instruction (handled by editor's mechanical cleanup)

---

### Phase 2D: Game-Type Alignment Check

**File changed:** `src/lib/blog/fact-checker.ts`

Added `checkGameTypeAlignment()` as Check 0 (pre-check). Uses `allowVideoGames` boolean from the topic template instead of hardcoded `topicIndex >= 341`, making it future-proof when topic pool expands.

**Also changed:** `src/lib/blog/types.ts` (added `allowVideoGames` to TopicTemplate), pipeline.ts, game-fetcher.ts

---

### Phase 2E: Game-Fetcher Topic Awareness

**File changed:** `src/lib/blog/game-fetcher.ts`

Added basic topic-aware filtering by parsing the title hint:
- "solo" / "1 player" / "alone" -> `min_players <= 1`
- "2 player" / "two player" -> `min_players <= 2, max_players >= 2`
- "under 30 minutes" / "quick" -> `avg_play_time <= 30`
- "party" / "5+ players" / "large group" -> `max_players >= 5`

Replaced `topicIndex >= 341` with `allowVideoGames` parameter.

---

### Phase 2F: Internal Linking via Recent Posts

**Files changed:**
- `src/lib/blog/pipeline.ts` -- Queries 15 most recent published posts before calling generateDraft
- `src/lib/blog/generator.ts` -- Updated signature and prompt to accept and display recent posts for internal linking

---

### Phase 3A-C: Slot-Based Topics + 2x Cron

**Files changed:**
- `src/lib/blog/topic-picker.ts` -- `pickTopic(date?, slot?)` with `(dayOfYear * 2 + slot) % TOPIC_TEMPLATES.length`
- `src/lib/blog/pipeline.ts` -- Accepts `slot` parameter
- `src/app/api/blog/generate/route.ts` -- Reads `slot` from query params
- `vercel.json` -- Two cron entries: slot=0 at 6 AM UTC, slot=1 at 6 PM UTC

---

### Phase 3D: Topic Pool Expansion

**File changed:** `src/lib/blog/topic-picker.ts`

Expanded from 365 to 730+ templates. New categories:
- Opinion/Hot Take, Deep Dives, Seasonal, Buying Guides, Beginner Guides
- Collection Management, Game Night Hosting, Crossover/Lifestyle
- Hidden Gems, Head-to-Head, Genre Explainers, Narrative/Storytelling
- Strategy Tips, Meta/Industry

Each new template includes a `format` field for prompt customization.

---

### Phase 3E: Image Handling

**File changed:** `src/lib/blog/image-processor.ts`

Added support for RAWG (`media.rawg.io`) and IGDB (`images.igdb.com`) image URLs. BGG-specific resize logic only applied to BGG URLs.

---

### Phase 4: Pipeline Monitoring

**Files created/changed:**
- `supabase/migrations/032_blog_pipeline_runs.sql` -- New tracking table
- `src/app/api/blog/generate/route.ts` -- Inserts run record at start, updates at end with all metrics

---

### Phase 5: Affiliate Configuration

**File created:** `src/lib/affiliate-config.ts`

Centralized affiliate tag management. Currently only Amazon (`boredgame-20`) is active. Target and Walmart affiliate programs need to be applied for by the user:
- Target: https://affiliate.target.com (via Impact.com)
- Walmart: https://affiliates.walmart.com (via Impact.com)

Updated `BuyOptions.tsx` and generator prompt to use centralized config.

---

### Phase 6: Tests

**Files created:**
- `src/lib/blog/topic-picker.test.ts`
- `src/lib/blog/editor.test.ts`
- `src/lib/blog/fact-checker.test.ts`

All test pure-code functions (no LLM mocking needed).

---

## User Action Items

After deploy, the user needs to:
1. Check Vercel dashboard for cron job status and function logs
2. Check Resend dashboard for domain verification status
3. Verify Vercel plan supports `maxDuration: 300` (Pro required)
4. Apply for Target affiliate program at https://affiliate.target.com
5. Apply for Walmart affiliate program at https://affiliates.walmart.com
6. Contact GameNerdz about affiliate program (check footer)
7. Once approved, update affiliate tags in `src/lib/affiliate-config.ts`
