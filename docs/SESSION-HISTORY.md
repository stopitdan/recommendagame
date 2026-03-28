# boredgame.lol — Complete Session History

**Date:** March 25-26, 2026
**Session:** ~18 hours of continuous development

---

## Project Overview

**boredgame.lol** is a smart game recommendation engine that helps users find board games, video games, word games, and party games. Users answer questions, describe what they want in natural language, or browse a catalog of 100k+ games. An AI-powered recommendation engine scores and ranks games across multiple dimensions.

**Live at:** https://boredgame.vercel.app
**Repo:** https://github.com/stopitdan/boredgame
**Branch:** main

### Tech Stack
- **Frontend:** Next.js 16.2.1 + React 19 + MUI 7 + Motion (Framer Motion)
- **Backend:** Next.js API routes (serverless on Vercel)
- **Database:** Supabase PostgreSQL (Pro tier, $25/mo) + pgvector extension
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **AI/LLM:** OpenAI GPT-4o-mini for free text parsing
- **3D:** Three.js + React Three Fiber (d20 dice roller)
- **Deployment:** Vercel (manual `vercel --prod`, GitHub connected but auto-deploy not working)
- **Testing:** Vitest + React Testing Library (232+ tests)

---

## What Was Built (Chronological)

### Phase 1: Data Pipeline
- **BGG Adapter** — XML API2 with Bearer token auth, XML parsing, 202 retry logic, rate limiting (5.5s between requests)
- **RAWG Adapter** — JSON API for video games, metacritic, ESRB, platforms
- **Word Games Dataset** — 47 curated games including 27 "no equipment needed" games
- **BGG Kaggle Import** — 22k board games from Kaggle dataset (descriptions are lemmatized garbage — being replaced by live API data)
- **BGG Live API Crawler** — `scripts/crawl-bgg-api.ts` scanning IDs 1-400,000. Includes expansions (`is_expansion` flag). Was at ~40k when last checked. Runs at 20 IDs per 5.5 seconds. Stores real HTML descriptions, ratings, mechanics, categories, designers, etc.
- **RAWG Crawler** — 80k+ video games ingested via pagination
- **Supabase Schema** — 9 migrations (001-009). Tables: games, game_embeddings, user_profiles, user_preferences, user_game_feedback, user_favorites, user_saved_presets, user_reviews, llm_parse_cache, user_achievements

### Phase 2: Auth & Users
- **Email/Password Auth** with session refresh proxy
- **Google OAuth** via Supabase + Google Cloud Console (PKCE flow with @supabase/ssr cookie storage)
- **Email Confirmation** flow with /signup/confirm page
- **Guest Mode** — localStorage preferences, signup prompt after 3 recommendations
- **Profile Hub** — stats, favorites, reviews, presets tabs
- **Settings Page** — popularity mode, min rating, source toggles

### Phase 3: Questionnaire & UI
- **Free Text First** — moved from step 7 to step 1. Users type "I want a roguelike deck builder for 2 players" and GPT-4o-mini extracts structured preferences
- **LLM Parsing** — OpenAI GPT-4o-mini with JSON mode, temperature=0, 8s timeout
- **Two-Tier Cache** — in-memory (1hr TTL) + Supabase llm_parse_cache table with fuzzy matching (Levenshtein distance < 15% on normalized text)
- **DB Enrichment** — when LLM identifies "similarTo" games, looks them up in DB and fills player count, complexity, time, genres from actual game data
- **Smart Questionnaire Filtering** — hides irrelevant options based on previous answers (e.g., no "Competitive" mood for solo players, no "Platformer" for board-only)
- **Player Count as Single-Pick Chips** — circular numbered chips (1-8, 9+), conversational "How many players do you have?"
- **"Find games →" / "Customize filters"** — two-path UI from the free text step
- **Editable Search on Results** — prompt visible and editable after getting results
- **Game Type Quick Chips** — Board/Video/Word/Party filter on results page

### Phase 4: Recommendation Engine
- **Layer 1: Rule-Based Scoring** — 9 weighted dimensions: type, players, time, complexity, genre, mood, free text, quality, popularity
- **Layer 2: Content-Based Filtering** — 768-dim embeddings for games, cosine similarity via pgvector HNSW index. 26.5k embeddings generated.
- **Layer 3: Collaborative Filtering** — item-based + user-based (activates with enough reviews)
- **Layer 4: Feedback Loop** — reviews update user preference vectors
- **Hybrid Engine** — rule-based (60%) + content similarity (40%)
- **Progressive Fallback** — 4 tiers: full filters → drop type → drop player count → nuclear (no filters). Never returns 0 results.
- **Free Text Scoring** — LLM-extracted mechanics/genres/keywords matched against game attributes. Falls back to regex keyword extraction when LLM unavailable.
- **100 results** returned (candidate pool of 500)

### Phase 5: Polish & Delight
- **Dark Mode** — full light/dark via `createAppTheme(mode, presetId)`. System default detection, localStorage persistence, toggle in header + mobile nav
- **6 Color Presets** — Game Night Glow (default), Ocean Breeze, Neon Arcade, Forest Grove, Sunset Mesa, Midnight Royal. Stored in `src/lib/color-presets.ts`. Switch via `localStorage.setItem('rag_color_preset', 'neon-arcade')` (UI picker not built yet)
- **3D D20 Dice Roller** — Physics-correct rigid body rotation (quaternion integration), precession for multi-axis tumble, parabolic bounce arcs (5 bounces, 60% decay each), starts face 20 on load, face toward camera on settle. Natural 20 = confetti celebration. Natural 1 = blood drips + screen shake.
- **Staggered Card Reveals** — GameCard wrapped in motion.div, 40ms stagger per index
- **Rating Counter Animation** — AnimatedRating shared component, counts up from 0.0 to value, 800ms, delayed until after card reveal
- **Favorite Heart Micro-Animation** — 12 colored particles burst (mixed circles + squares), heart bounces [1, 1.5, 0.85, 1.15, 1], optimistic update
- **Scroll Progress Indicator** — thin gradient line (indigo→coral), direct DOM manipulation via requestAnimationFrame for zero latency
- **Page Transitions** — simple fade-in on route change (no exit animation — Next.js App Router limitation)
- **Themed Loading Animations** — GameLoader component with 3 variants: bouncing dice, shuffling cards, swaying magnifying glass
- **Parallax Game Art Headers** — mobile-only, cover art scrolls at 40% speed with gradient overlay
- **Custom Tooltips** — 500ms enter delay globally, styled with rounded corners + shadow, descriptive not duplicative
- **Nav Microanimations** — emoji wiggle on button hover (CSS keyframe), hover lift (motion), tap scale
- **Dice Emoji Favicon** — SVG favicon with 🎲
- **Game Type Labels** — formatGameType() shared utility, "board" → "Board Game" everywhere

### Phase 6: Growth
- **Vercel Deployment** — manual `vercel --prod`. GitHub connected but auto-deploy integration is flaky.
- **Share Game Night Invite** — /invite?game=ID&host=Name page. ShareInviteButton uses Web Share API on mobile, clipboard on desktop.

### Phase 7: Achievements
- **43 achievements** across 8 categories, all with active triggers:
  - Dice: First Roll, Natural 20 Club, Critical Failure, Lucky Streak, Snake Eyes, Double Down, Century Club, Speed Demon
  - Discovery: Game Seeker, Picky Player, Wordsmith, Genre Hopper, Deep Diver, Time Traveler, Retro Gamer, Cutting Edge
  - Social: Party Planner, Social Butterfly, Game Group, Organized
  - Reviews: Bookworm, Collector, Critic, Seasoned Critic, Harsh Critic, Fanboy, Essay Writer, Contrarian
  - Settings: Customizer, Dark Side
  - Easter Eggs: 42, Konami Code (↑↑↓↓←→←→BA), Rick Rolled, Secret Menu (/future-roadmap)
  - Time: Night Owl (midnight-4am), Loyal Fan (7-day streak), Veteran (30+ days), Founding Member (before Aug 2026)
  - Meta: Explorer (50+ games browsed), Power User (10+ features/session), Completionist+ (all others)
- **AchievementProvider** wraps entire app, provides `useAchievements()` hook
- **Toast notifications** with spring animation, rarity-colored borders, emoji bounce, 4s auto-dismiss
- **Supabase table** `user_achievements` with RLS

### Browse Page
- **Rich Filter Panel** — collapsible with Apply/Clear buttons
- **Filters:** player count slider, play time slider, complexity slider, min rating slider, year range slider, category autocomplete, mechanic autocomplete, theme autocomplete, platform autocomplete, designer (free text), publisher (free text)
- **Multi-select autocompletes** with `disableCloseOnSelect`, chip pills with X to remove
- **Deferred application** — sliders/autocompletes don't re-fetch until Apply or panel close
- **Type chips** at top (All/Board/Video/Word/Party)
- **Popularity modes** (Popular/All/Hidden Gems)
- **GIN indexes** on: types, categories, mechanics, themes, platforms, designers, publishers, developers

### Results Page
- **Server-side refine filters** — player count, time, complexity, min rating all re-fetch from API
- **Multi-select autocompletes** for category, mechanic, theme, platform
- **Client-side name search** ("Search within results...")
- **Game type quick chips** (Board/Video/Word/Party)
- **Popularity toggle**
- **"Why we picked this" reason chips**

### Random Game
- **Cached approach** — fetches top 200 by `rating >= 6.5`, picks randomly, caches for 5 minutes
- **Per-type caching** — separate cache for board/video/word/party
- **Client-side retry** — 3 attempts with 500ms delay
- **Serves stale cache** on DB errors

---

## Known Issues & Problems

### Recommendation Quality (THE Big Problem)
1. **Candidate pool is "top 500 by rating"** — misses niche games. "A roguelike deck builder" gets generic hits. Need pgvector primary retrieval (query by preference vector, not just rating).
2. **Video game data is weak** — RAWG API missing key metadata. "A metroidvania about bugs" doesn't find Hollow Knight. Need IGDB integration.
3. **BGG descriptions from Kaggle are garbage** — lemmatized word soup. The live API crawler is replacing these but only ~40k/400k done.
4. **No negative signals** — no "Not This" button. Users can't tell the engine what they DON'T want.

### Performance
5. **Supabase queries on 100k+ rows can be slow** — ORDER BY + complex filters time out. Fixed for random game (cached), browse (estimated count), but recommend endpoint still pulls 500 rows with filters.
6. **No Redis caching** — everything hits Supabase on every request. In-memory caches help but reset on cold starts.

### Data
7. **BGG crawler still running** — at ~40k of 400k IDs. Will take ~30 hours total. Running via `npx tsx scripts/crawl-bgg-api.ts 1500 400000`
8. **No IGDB data yet** — need Twitch developer account for API access

### UI/UX
9. **Color theme picker not in settings UI** — presets exist but only switchable via localStorage
10. **Vercel auto-deploy broken** — GitHub integration flaky, using manual `vercel --prod`
11. **Some `(game as any)` type casts** in RandomGameView — should use proper Game type

---

## Environment & Config

### .env.local Keys
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAWG_API_KEY`
- `BGG_API_KEY` (Bearer token for BGG XML API2)
- `OPENAI_API_KEY` (for GPT-4o-mini text parsing)

### Vercel Env Vars
Same as above. Needs `OPENAI_API_KEY` added for LLM parsing on production.

### Supabase
- **Pro tier** ($25/mo) — 8GB storage, 2-minute statement timeout, 200 connections
- **Migrations 001-009** all applied
- **pgvector extension** enabled
- **GIN indexes** on array columns (types, categories, mechanics, themes, platforms, designers, publishers, developers)
- **HNSW index** on game_embeddings.embedding for cosine similarity

### Key Scripts
- `npx tsx scripts/crawl-bgg-api.ts [startId] [endId]` — BGG ingestion
- `npx tsx scripts/crawl-rawg.ts [maxPages]` — RAWG ingestion
- `npx tsx scripts/generate-embeddings.ts` — Generate 768-dim embeddings
- `npx tsx scripts/bust-llm-cache.ts` — Clear LLM parse cache
- `npx tsx scripts/import-bgg-kaggle.ts` — Import from Kaggle dataset
- `npm run test:run` — Run all tests
- `npm run build` — Production build
- `vercel --prod` — Deploy to production

---

## Next Steps (Priority Order)

### Immediate: Fix Recommendation Quality
1. **pgvector Primary Retrieval** — Use vector similarity as primary candidate source instead of "top N by rating." Hybrid: 250 by vector similarity + 250 by rating. 2-3 hours. $0.
2. **"Not This" + "More Like This" buttons** — Interactive discovery on each game card. 1-2 hours. $0.
3. **Caching Layer (Redis via Upstash)** — Sub-100ms cached responses. 1 hour. $0-5/mo.
4. **IGDB Integration** — Better video game data. Fixes "metroidvania about bugs" → Hollow Knight. 3-4 hours. $0 (free API, needs Twitch dev account).

### After That
5. Trending / Seasonal Recommendations
6. Advanced LLM Intelligence (multi-turn, tone detection)
7. Import BGG / Steam Library
8. Conversational Recommendations
9. Game Group Matching
10. FAQ / Tutorial Page
11. Tech Stack Diagram

### Ongoing
- BGG crawler completing 400k ID scan
- Test coverage improvements
- Shared component refactor audit

---

## Architecture Notes

### Recommendation Pipeline
```
User Input → LLM Parse (GPT-4o-mini) → Cache Check
  → Candidate Fetching (Supabase, 500 games)
    → Rule-Based Scoring (9 dimensions)
    → In-Memory Similarity (768-dim vectors)
    → SimilarTo Resolution (DB lookup)
  → Top 100 Results → Client
```

### Database Schema (key tables)
- `games` — 100k+ rows, 60+ columns, unified schema for all sources
- `game_embeddings` — 768-dim vectors, HNSW index, cosine similarity
- `user_profiles` / `user_preferences` — extends Supabase Auth
- `user_reviews` — 1-10 rating + text, publicly readable
- `user_favorites` — bookmarked games
- `user_saved_presets` — named questionnaire preferences
- `user_achievements` — unlocked achievements with timestamps
- `llm_parse_cache` — cached LLM responses with normalized input keys

### Key Files
- `src/app/api/recommend/route.ts` — Main recommendation endpoint
- `src/lib/recommendation/scoring.ts` — 9-dimension scoring engine
- `src/lib/recommendation/embeddings.ts` — Vector embedding generation
- `src/lib/llm/parse-preferences.ts` — GPT-4o-mini integration
- `src/lib/llm/cache.ts` — Two-tier fuzzy cache
- `src/lib/color-presets.ts` — Pluggable color theme system
- `src/theme.ts` — MUI theme factory (reads from presets)
- `src/components/ThemeRegistry.tsx` — Dark mode + color preset provider
- `src/components/AchievementToast.tsx` — Achievement system provider + toast
- `src/components/PhysicsDice.tsx` — 3D d20 with rigid body physics
- `src/components/GameCard.tsx` — Shared game card with stagger + animated rating
- `src/components/AnimatedRating.tsx` — Shared count-up rating component
- `src/components/GameLoader.tsx` — Themed loading animations
- `src/lib/achievements.ts` — 43 achievement definitions
- `src/lib/filter-options.ts` — Shared filter option lists
- `src/lib/questionnaire-context.ts` — Smart questionnaire filtering
- `src/lib/guest.ts` — Guest mode localStorage utilities
- `docs/MASTER-TODO.md` — Master tracking file for all phases
