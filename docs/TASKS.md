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
- [x] Define questionnaire types and constants (`src/types/questionnaire.ts`)
- [x] Build multi-step wizard component (`src/app/questionnaire/QuestionnaireFlow.tsx`)
- [x] Progress bar and step navigation (back, next, skip)
- [x] Step 1: Game type selection — clickable cards (board/video/word/party/surprise me)
- [x] Step 2: Player count — range slider (1–10+)
- [x] Step 3: Time available — preset pill chips (quick/short/medium/long/epic)
- [x] Step 4: Complexity — range slider with labels (chill → brain burner)
- [x] Step 5: Genre selection — multi-select chip grid (20 genres)
- [x] Step 6: Mood/vibe — clickable cards, multi-select (competitive/coop/chill/etc.)
- [x] Step 7: Free text — optional natural language input
- [x] Submit builds query params and navigates to /results

### 3.2 Filter Sidebar
- [ ] Build filter panel component (for returning users who skip questionnaire)
- [ ] Wire filters to search/recommendation API
- [ ] Persist last-used filters for logged-in users

### 3.3 Results Page
- [x] GameCard component (image, title, rating, player count, categories, description)
- [x] Results list layout with loading/empty/error states
- [x] Fetch from `/api/games/search` based on questionnaire params
- [x] "Start Over" button to return to questionnaire
- [ ] "Why we picked this" explanation text (Phase 4 — needs recommendation engine)
- [ ] Pagination or infinite scroll
- [ ] Thumbs up/down feedback buttons
- [ ] Empty state / no results handling

---

## Phase 3b: User Features & Smart Recommendations (CURRENT)

### 3b.1 Popularity Bias in Recommendations
- [x] Add composite scoring to search API (name match + rating + popularity signal)
- [x] Prefer popular games by default (min 50 rating_count threshold)
- [x] Add `popularity` query param: "popular" (default), "any", "hidden-gems"
- [x] Popularity toggle chips on results page
- [x] "Try including all games" fallback when popular mode finds no results
- [x] Hidden gems mode: lower popularity weight, higher rating weight, max rating_count cap

### 3b.2 User Favorites / Library
- [x] `POST /api/favorites` — add a game to favorites
- [x] `DELETE /api/favorites/[gameId]` — remove a game from favorites
- [x] `GET /api/favorites` — list user's favorites (with joined game data)
- [x] Favorites page (`/favorites`) with empty state, auth gate, remove support
- [x] Heart/favorite button on GameCard (FavoriteButton component)
- [x] "Favorites" link in header for logged-in users
- [ ] Favorite toggle on game detail page (needs game detail page first)

### 3b.3 Saved Preference Sets
- [x] DB migration: `user_saved_presets` table with JSONB preferences, RLS policies
- [x] API routes: GET/POST `/api/presets`, PUT/DELETE `/api/presets/[id]`
- [x] "Save Preset" dialog on questionnaire last step
- [x] Presets page (`/presets`) — list, use, delete presets
- [x] Preset description summary (type, players, time, genres)
- [ ] Load a preset to pre-fill the questionnaire steps (edit mode)
- [ ] Quick-access from home page ("Your presets")

### 3b.4 Recommendation Settings (per-user)
- [x] DB migration: added popularity_mode, min_rating, excluded_sources to user_preferences
- [x] Settings page (`/settings`) with UI controls
- [x] GET/PUT `/api/settings` API routes
- [ ] Apply saved settings to search/recommendation API automatically

### 3b.5 User Reviews & Ratings
- [x] DB migration: `user_reviews` table (1-10 rating, review text, RLS, aggregate function)
- [x] API routes: GET `/api/reviews?gameId=xxx`, POST `/api/reviews`
- [x] ReviewForm component with star rating + optional text
- [x] ReviewList component showing reviews with author, rating, date
- [x] Reviews section on game detail page (form + list with refresh)
- [ ] Average user review score shown on GameCard
- [ ] Reviews factor into recommendation scoring (Phase 4)
- [ ] Higher weight for reviews from users with similar preferences (Phase 4)

### 3b.6 Game Detail Pages
- [x] API route `GET /api/games/[id]` — fetch single game
- [x] Dynamic route (`/games/[id]`) with full game info page
- [x] Image, name, rating badge, types, year, players, time, complexity
- [x] Categories, mechanics, themes, platforms as chip groups
- [x] External link to source (BGG/RAWG)
- [x] Favorite button
- [x] Back navigation
- [x] Clickable game names on GameCard navigate to detail page
- [ ] Review form + existing reviews (needs 3b.5)
- [ ] Related game recommendations (Phase 4)

### 3b.7 Leaderboard
- [x] API route `GET /api/leaderboard` — top games by rating (min 100 ratings)
- [x] Leaderboard page (`/leaderboard`) with ranked game list
- [x] Type filter chips (All / Board / Video / Word)
- [x] Top 3 highlighted in Rosewood
- [ ] Sort by user favorites count (once more users)
- [ ] Time period filter (all time, this month, this week)

### 3b.8 Landing Page Glow-Up
- [x] Animated hero section with staggered blur-in text entrance + parallax scroll
- [x] Feature highlights section (4 cards with scroll-triggered stagger + spring hover)
- [x] Stats section (animated counters: 26k+ games, 3 categories, 150+ genres)
- [x] How it works section (3-step with scroll-triggered stagger reveal)
- [x] CTA sections throughout (dual hero CTAs + bottom CTA)
- [x] motion library (framer-motion successor) for all animations
- [x] Floating dice decorations with gentle bobbing animation

---

## Phase 4: Recommendation Engine

### 4.1 Rule-Based Scoring
- [ ] Define scoring weights for each preference dimension
- [ ] Implement scoring function (not just filtering — weighted match score)
- [ ] Popularity factor in scoring (configurable weight)
- [ ] Rank games by composite score
- [ ] Return top N with scores and "why we picked this" reasons

### 4.2 Content-Based Filtering
- [ ] Build feature vectors from game metadata (genres, mechanics, themes, complexity)
- [ ] Implement similarity calculation (cosine similarity via pgvector)
- [ ] "Because you liked X" recommendations
- [ ] Similar games on game detail page

### 4.3 Collaborative Filtering
- [ ] Import BGG Kaggle user_ratings (18.9M rows) for training data
- [ ] Design user-game interaction matrix
- [ ] Implement collaborative filtering algorithm
- [ ] Weight reviews from preference-similar users higher
- [ ] Minimum user threshold before activating

### 4.4 Feedback Loop
- [ ] User reviews feed into preference vector updates
- [ ] Favorites influence future recommendations
- [ ] Track recommendation accuracy over time

### 4.5 Hybrid Engine
- [ ] Combine rule-based + content-based + collaborative scores
- [ ] Weight by data availability (more users → more collaborative signal)
- [ ] A/B test different weight configurations

---

## Phase 5: Polish & Production

### 5.1 UX & Design
- [ ] Responsive mobile-first layouts
- [ ] Loading states and skeletons
- [ ] Error boundaries and fallback UI
- [ ] Accessibility audit
- [ ] Pagination / infinite scroll on results

### 5.2 Infrastructure
- [ ] Rate limiting on API routes
- [ ] Graceful degradation when external APIs are down
- [ ] Environment-based configuration
- [ ] Deployment setup (Vercel)
- [ ] BGG weekly sync cron (once API token is approved)

### 5.3 Analytics
- [ ] Track recommendation impressions
- [ ] Track click-through rates
- [ ] Track favorite/review rates
- [ ] Dashboard or logging for monitoring
