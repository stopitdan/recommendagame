# Task Tracker

Granular tasks organized by phase. Update status as work progresses.

**Legend:** `[ ]` Not started | `[~]` In progress | `[x]` Complete | `[!]` Blocked

---

## Phase 1: Data Layer & Game APIs

### 1.1 Unified Game Schema
- [x] Define `Game` TypeScript interface
- [x] Define supporting types (`GameSource`, `GameType`, `PlayerCount`, etc.)
- [x] Define `GameAdapter` interface
- [x] Create `src/types/game.ts`
- [x] Create `.env.example`

### 1.2 BoardGameGeek Adapter
- [x] XML parser, BGG types, API client, search, detail fetching
- [x] Rate limiting, 202 retries, player count poll parsing
- [x] BGG Kaggle dataset import (22k games with full metadata)
- [x] Tests for mapping and fetch logic
- [!] Live API access pending BGG application approval

### 1.3 RAWG Adapter (Video Games)
- [x] Full adapter: search, detail, popular, mapping, normalization
- [x] Crawler with exponential backoff (80k+ games imported)
- [x] Backfill script for descriptions/developers/publishers
- [x] Extended metadata: metacritic, ESRB, developers, publishers
- [x] Tests for adapter

### 1.4 Word & Party Game Data
- [x] 20 curated digital word games (Wordle, Connections, etc.)
- [x] 19 no-equipment party games (Charades, Mafia, 20 Questions, etc.)
- [x] Local adapter implementing GameAdapter interface
- [x] Tests for data integrity

### 1.5 Supabase Database
- [x] 4 migrations: initial schema, extended metadata, BGG fields, presets/reviews
- [x] pgvector extension + HNSW index for similarity search
- [x] Full RLS policies for all tables
- [x] RPC functions (match_games, search_games_by_name, get_game_review_stats)
- [x] Browser + server Supabase clients
- [x] Game ↔ DB row conversion helpers

### 1.6 Data Pipeline
- [x] Game sync service with upsert, batch processing, retry
- [x] RAWG crawler (80k+ games, exponential backoff)
- [x] BGG Kaggle import script (22k games, full metadata)
- [x] RAWG detail backfill script
- [x] Embedding generation script (26.5k embeddings)
- [x] Test data seed script (5 test users with favorites/reviews/presets)
- [x] POST /api/sync endpoint

### 1.7 Unified Search
- [x] GET /api/games/search with FTS, ILIKE fallback, external fan-out
- [x] Background sync of external results
- [x] Filter by type, source, player count, complexity

---

## Phase 2: Auth & User Profiles

- [x] Supabase Auth (email/password)
- [x] Next.js proxy for session refresh
- [x] Login/signup pages and server actions
- [x] Header with auth state
- [ ] Google OAuth (future)
- [ ] Guest mode with localStorage (future)

---

## Phase 3: Questionnaire & UI

### 3.1 Questionnaire Flow
- [x] 7-step wizard: type → players → time → complexity → genre → mood → free text
- [x] Progress bar, back/next/skip navigation
- [x] Save preset dialog on completion
- [x] Emojis and selection animations on all steps

### 3.2 Results Page
- [x] Uses /api/recommend (4-layer engine, not just search)
- [x] "Why we picked this" reason chips per game
- [x] Popularity toggle (Popular / All / Hidden Gems)
- [x] Loading skeletons instead of spinner
- [x] Share results button (copies URL to clipboard)
- [x] Engine metadata display (scored X games, engine version)

### 3.3 Game Detail Pages
- [x] Full info: image, rating, players, time, complexity, year
- [x] Categories, mechanics, themes, platforms as clickable chips
- [x] External source link
- [x] Favorite button
- [x] Review form + review list
- [x] Similar games section (pgvector + fallback)

### 3.4 Browse Page
- [x] Server-side filtering with clickable tag navigation
- [ ] Improve filters (sort options, more filter dimensions)

### 3.5 Leaderboard
- [x] Top games by rating (min 100 ratings)
- [x] Type filter chips
- [x] In-memory caching (5 min TTL)

### 3.6 User Features
- [x] Favorites (add/remove/list with heart button)
- [x] Saved presets (create/list/delete with JSONB preferences)
- [x] User reviews (1-10 rating + optional text, public read)
- [x] Settings page (popularity mode, min rating, source toggles)
- [x] Profile hub (/profile) with stats, tabs (favorites/reviews/presets)
- [x] Avatar dropdown menu in header

---

## Phase 4: Recommendation Engine — COMPLETE

### 4.1 Rule-Based Scoring (Layer 1)
- [x] 8-dimensional scoring: type, player count, time, complexity, genre, mood, quality, popularity
- [x] Configurable weights (default, popular, hidden-gems profiles)
- [x] Human-readable "why we picked this" reason generation
- [x] Tightness scoring for player count (prefers games designed for the range)
- [x] Quality floor (100+ ratings for popular, 20+ for hidden gems)
- [x] 47 unit tests

### 4.2 Content-Based Filtering (Layer 2)
- [x] 768-dim attribute vectors (categories, mechanics, themes, types, numerics)
- [x] Cosine similarity search (pgvector HNSW + in-memory fallback)
- [x] User preferences → vector encoding
- [x] Embedding generation script (26.5k games embedded)
- [x] Similar games endpoint (GET /api/games/[id]/similar)
- [x] 15 unit tests (vectors, similarity, semantic validation)

### 4.3 Collaborative Filtering (Layer 3)
- [x] Item-based CF: "users who liked X also liked Y"
- [x] User-based CF: find users with similar taste, recommend their likes
- [x] Minimum feedback thresholds before activation
- [x] Tests for edge cases

### 4.4 Feedback Loop (Layer 4)
- [x] Rating → signal mapping (1-10 → -0.2 to +0.3)
- [x] Preference vector update on review submission
- [x] Full vector rebuild from all reviews
- [x] 12 unit tests

### 4.5 Hybrid Engine
- [x] POST /api/recommend combining all layers
- [x] Hybrid score = 0.6 * rule_score + 0.4 * similarity_score
- [x] Auto-detects best available layer (pgvector → in-memory → rule-only)
- [x] Engine version reporting (rule-based-v1 / hybrid-v1 / hybrid-inmemory-v1)
- [x] 7 API route tests

---

## Phase 5: Polish & Production

### Design System
- [x] "Game Night Glow" color palette (Indigo + Coral + Teal + Amber)
- [x] Gradient buttons, cards, chips with glow effects
- [x] MUI theme with full component overrides
- [x] No hardcoded colors in components

### UX & Performance
- [x] Loading skeletons on results page
- [x] Error boundary wrapping main content
- [x] In-memory caching (leaderboard 5m, similar games 5m, browse 2m)
- [x] Fully clickable GameCards with hover lift effect
- [x] Share results button
- [x] Motion animations on landing page (parallax, stagger, springs)
- [x] Emoji iconography throughout (questionnaire, nav, profile)
- [ ] Responsive mobile optimization pass
- [ ] Accessibility audit

### Infrastructure
- [ ] Vercel deployment + CI/CD
- [ ] Rate limiting on API routes
- [ ] Redis/Vercel KV for persistent caching
- [ ] BGG weekly sync cron (pending API token)

### Content & Growth
- [ ] FAQ / tutorial page
- [ ] AI-generated blog posts about games
- [ ] SEO optimization
- [ ] Help desk / bug reporting (GitHub Issues link)
- [ ] Google Ads integration
- [ ] Email validation in Supabase
- [ ] Marketing plan

---

## Test Coverage

**Total: 214+ tests across 18+ files**

| Area | Tests | Status |
|------|-------|--------|
| Scoring engine | 47 | ✅ |
| Embeddings + similarity | 15 | ✅ |
| Collaborative filtering | 3 | ✅ |
| Feedback loop | 12 | ✅ |
| Recommend API | 7 | ✅ |
| BGG adapter | 10+ | ✅ |
| RAWG adapter | 10+ | ✅ |
| Local adapter | 11 | ✅ |
| Search API | 5+ | ✅ |
| Reviews API | 5 | ✅ |
| Leaderboard API | 3+ | ✅ |
| Presets API | 5+ | ✅ |
| Profile API | 2 | ✅ |
| Settings API | 3+ | ✅ |
| Favorites API | 5+ | ✅ |
| Game detail API | 3+ | ✅ |
| Cache utility | 9 | ✅ |
| Questionnaire types | 5+ | ✅ |

---

## Needs From Daniel (Blocked Items)

- [ ] **BGG API token** — Application submitted, awaiting approval. Once approved, add `BGG_API_TOKEN` to `.env.local` and we can set up live API sync.
- [ ] **Vercel deployment** — Need to connect repo to Vercel for hosting. May need Vercel account.
- [ ] **Redis/Vercel KV** — For persistent caching across serverless invocations. Upstash free tier or Vercel KV ($). Set `REDIS_URL` in `.env.local`.
- [ ] **Supabase upgrade** — Free tier (500MB) is fine for now. Upgrade when we import the 18.9M user ratings for collaborative filtering.
- [ ] **Google OAuth** — Need to configure in Supabase dashboard + Google Cloud Console for social login.
