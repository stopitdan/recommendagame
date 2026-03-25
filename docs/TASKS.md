# Task Tracker

Granular tasks organized by phase. Update status as work progresses.

**Legend:** `[ ]` Not started | `[~]` In progress | `[x]` Complete | `[!]` Blocked

---

## Phase 1: Data Layer & Game APIs

### 1.1 Unified Game Schema
- [x] Define `Game` TypeScript interface (name, description, playerCount, categories, complexity, duration, rating, imageUrl, source, sourceId, etc.)
- [x] Define supporting types (`GameSource`, `GameType`, `PlayerCount`, `PlayTime`, `SearchOptions`, etc.)
- [x] Define `GameAdapter` interface that all adapters must implement
- [x] Create `src/types/game.ts`
- [x] Create `.env.example` with placeholder keys for all APIs

### 1.2 BoardGameGeek Adapter
- [x] Install XML parser (`fast-xml-parser`)
- [x] Define BGG-specific XML response types (`src/types/bgg.ts`)
- [x] Build BGG API client (`src/lib/adapters/bgg.ts`)
- [x] Implement search (two-step: /search for IDs → /thing for details)
- [x] Implement game detail fetching (single + batched)
- [x] Implement hot/popular list fetching
- [x] Map BGG XML response to unified `Game` schema
- [x] Handle rate limiting (5s throttle between requests)
- [x] Handle 202 "not ready" retries with backoff
- [x] Parse suggested_numplayers poll for recommended player count
- [x] Strip HTML from descriptions
- [ ] Write tests
- [ ] Smoke test against live BGG API

### 1.3 RAWG Adapter (Video Games)
- [x] Sign up for RAWG API key
- [x] Define RAWG-specific response types (`src/types/rawg.ts`)
- [x] Build RAWG API client (`src/lib/adapters/rawg.ts`)
- [x] Implement search (single-step — list endpoint returns rich data)
- [x] Implement game detail fetching (adds description, developers, publishers)
- [x] Implement popular/top-rated game fetching
- [x] Map RAWG JSON response to unified `Game` schema
- [x] Normalize rating from 0-5 → 0-10 scale
- [x] Convert playtime from hours → minutes
- [x] Extract platforms via parent_platforms for clean grouping
- [x] Extract themes from English-language tags
- [ ] Write tests
- [ ] Smoke test against live RAWG API

### 1.4 Word Game Data
- [x] Research data sources — no word game API exists; BGG covers physical word games (700+), digital needs curation
- [x] Create curated local dataset (`src/data/word-games.json`) — 20 digital word games (Wordle, Connections, Spelling Bee, etc.)
- [x] Build local adapter (`src/lib/adapters/local.ts`) implementing `GameAdapter` interface
- [x] Map local JSON entries to unified `Game` schema
- [x] Register local adapter in sync route
- [ ] Add more word games to the dataset as discovered

### 1.5 Supabase Database Setup
- [x] Install Supabase client packages (`@supabase/supabase-js`, `@supabase/ssr`)
- [x] Create database migration (`supabase/migrations/001_initial_schema.sql`)
- [x] Define games table with full metadata columns
- [x] Define game_embeddings table with pgvector (768 dimensions)
- [x] Define user_profiles, user_preferences, user_game_feedback, user_favorites tables
- [x] Set up Row Level Security policies
- [x] Create RPC functions (match_games, search_games_by_name)
- [x] Create Supabase browser client (`src/lib/supabase/client.ts`)
- [x] Create Supabase server client (`src/lib/supabase/server.ts`)
- [x] Create Game ↔ DB row conversion helpers (`src/lib/supabase/games.ts`)
- [x] Define TypeScript types for all tables (`src/types/supabase.ts`)
- [x] Update `.env.example` with Supabase vars
- [ ] Create Supabase project and run migration
- [ ] Verify schema in Supabase dashboard

### 1.6 Caching / Local DB Mirror
- [x] Build game sync service (`src/lib/sync/game-sync.ts`)
- [x] Upsert logic to avoid duplicate imports (`onConflict: 'source,source_id'`)
- [x] Batch processing with configurable batch size
- [x] Individual retry on batch failure (isolates which games fail)
- [x] `syncPopularFromAdapter()` — sync trending games from one source
- [x] `syncPopularFromAll()` — sync trending games from all sources
- [x] `syncSearchResults()` — cache search results as users search
- [x] `syncSingleGame()` — fetch and store a single game by ID
- [x] Create API route `POST /api/sync` with auth token protection
- [ ] Consider cron job for incremental sync (Vercel Cron or external)

### 1.7 Unified Search Service
- [x] Create `GET /api/games/search` route (`src/app/api/games/search/route.ts`)
- [x] Query Supabase (local DB) first via full-text search RPC
- [x] ILIKE fallback for partial matches when FTS returns nothing
- [x] Fan out to external adapters (BGG, RAWG, local) on cache miss
- [x] Background sync of external results to DB (fire and forget)
- [x] Deduplicate merged results by game ID
- [x] Filter by type, source, player count, complexity
- [x] Sort by relevance (exact match → starts with → rating)
- [x] Query params: `q`, `type`, `source`, `minPlayers`, `maxPlayers`, `minComplexity`, `maxComplexity`, `limit`

---

## Phase 2: Auth & User Profiles

### 2.1 Supabase Auth Setup
- [x] Configure Supabase Auth (email/password enabled by default)
- [x] Set up Next.js proxy for session refresh (`src/proxy.ts` — Next.js 16 renamed middleware → proxy)
- [x] Configure environment variables in `.env.local`
- [ ] Configure Google OAuth provider (later)
- [ ] Disable email confirmation for dev (manual step in Supabase dashboard)

### 2.2 Auth Integration
- [x] Create server actions for signup, login, logout (`src/app/actions/auth.ts`)
- [x] Create login page (`src/app/login/page.tsx` + `LoginForm.tsx`)
- [x] Create signup page (`src/app/signup/page.tsx` + `SignupForm.tsx`)
- [x] Add Header with auth state to root layout (`src/components/Header.tsx`)
- [x] HeaderAuth client component for login/logout buttons (`src/components/HeaderAuth.tsx`)
- [x] Server-side auth verification via `supabase.auth.getUser()`

### 2.3 User Profiles
- [x] Define user profile schema (in migration)
- [x] Define user preferences schema (in migration)
- [x] Create user profile + preferences rows on signup (in auth server action)
- [ ] Build profile preferences page
- [ ] Store game feedback (thumbs up/down)

### 2.4 Guest Mode
- [ ] Implement localStorage-based preference storage
- [ ] Prompt to create account after N recommendations
- [ ] Migrate localStorage data to Supabase on signup

---

## Phase 3: Questionnaire & Filter UI

### 3.1 Questionnaire Flow
- [ ] Design question sequence and logic
- [ ] Build multi-step form component
- [ ] Game type selection (board / video / word / party / any)
- [ ] Player count input
- [ ] Time available input
- [ ] Complexity preference slider
- [ ] Genre selection (multi-select)
- [ ] Mood/vibe picker (competitive, cooperative, chill, brain-teaser)

### 3.2 Filter Sidebar
- [ ] Build filter panel component
- [ ] Wire filters to search/recommendation API
- [ ] Persist last-used filters for logged-in users

### 3.3 Results Page
- [ ] Game card component (image, title, rating, player count, tags)
- [ ] Results grid/list layout
- [ ] "Why we picked this" explanation text
- [ ] Pagination or infinite scroll
- [ ] Empty state / no results handling

---

## Phase 4: Recommendation Engine

### 4.1 Rule-Based Scoring
- [ ] Define scoring weights for each preference dimension
- [ ] Implement scoring function
- [ ] Rank games by score
- [ ] Return top N with scores

### 4.2 Content-Based Filtering
- [ ] Build feature vectors from game metadata (genres, mechanics, themes, complexity)
- [ ] Implement similarity calculation (cosine similarity or similar)
- [ ] "Because you liked X" recommendations

### 4.3 Collaborative Filtering
- [ ] Design user-game interaction matrix
- [ ] Implement collaborative filtering algorithm (or integrate a library)
- [ ] Minimum user threshold before activating

### 4.4 Feedback Loop
- [ ] Thumbs up/down UI on recommendation cards
- [ ] Store feedback in Firestore
- [ ] Feed ratings back into scoring weights
- [ ] Track recommendation accuracy over time

### 4.5 Hybrid Engine
- [ ] Combine rule-based + content-based + collaborative scores
- [ ] Weight by data availability (more users → more collaborative signal)
- [ ] A/B test different weight configurations

---

## Phase 5: Polish & Production

### 5.1 Game Detail Pages
- [ ] Dynamic route (`src/app/games/[id]/page.tsx`)
- [ ] Full game info display
- [ ] External links (buy, play, BGG/RAWG page)
- [ ] Related game recommendations

### 5.2 User Features
- [ ] Favorites / "play later" list
- [ ] Recommendation history
- [ ] Preference editing

### 5.3 UX & Design
- [ ] Responsive mobile-first layouts
- [ ] Loading states and skeletons
- [ ] Error boundaries and fallback UI
- [ ] Accessibility audit

### 5.4 Infrastructure
- [ ] Rate limiting on API routes
- [ ] Graceful degradation when external APIs are down
- [ ] Environment-based configuration
- [ ] Deployment setup (Vercel)

### 5.5 Analytics
- [ ] Track recommendation impressions
- [ ] Track click-through rates
- [ ] Track feedback rates
- [ ] Dashboard or logging for monitoring
