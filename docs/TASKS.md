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
- [ ] Install XML parser (`fast-xml-parser`)
- [ ] Build BGG API client (`src/lib/adapters/bgg.ts`)
- [ ] Implement search endpoint
- [ ] Implement game detail fetching
- [ ] Map BGG XML response to unified `Game` schema
- [ ] Handle rate limiting (5s between requests)
- [ ] Write tests

### 1.3 RAWG Adapter (Video Games)
- [ ] Sign up for RAWG API key
- [ ] Build RAWG API client (`src/lib/adapters/rawg.ts`)
- [ ] Implement search endpoint
- [ ] Implement game detail fetching
- [ ] Map RAWG JSON response to unified `Game` schema
- [ ] Write tests

### 1.4 Word Game Data
- [ ] Research whether to use a curated local dataset or an API
- [ ] Build word game adapter or seed script
- [ ] Map to unified `Game` schema

### 1.5 Caching Layer
- [ ] Choose caching strategy (Redis, SQLite, or in-memory for dev)
- [ ] Implement cache wrapper for API calls
- [ ] Add TTL-based expiration
- [ ] Consider pre-fetching popular/hot games on a schedule

### 1.6 Unified Search Service
- [ ] Create `/api/games/search` route
- [ ] Fan out queries to all adapters
- [ ] Merge and deduplicate results
- [ ] Return normalized, ranked results

---

## Phase 2: Auth & User Profiles

### 2.1 Firebase Setup
- [ ] Create Firebase project
- [ ] Install Firebase SDK (`firebase`, `firebase-admin`)
- [ ] Configure environment variables
- [ ] Set up Firebase Auth providers (email/password, Google)

### 2.2 Auth Integration
- [ ] Build auth context provider (`src/contexts/AuthContext.tsx`)
- [ ] Create login page (`src/app/login/page.tsx`)
- [ ] Create signup page (`src/app/signup/page.tsx`)
- [ ] Add auth state to layout/header
- [ ] Implement server-side token verification for API routes

### 2.3 User Profiles
- [ ] Define Firestore user profile schema
- [ ] Create user profile on signup
- [ ] Build profile preferences page
- [ ] Store game history (recommended, liked, disliked)

### 2.4 Guest Mode
- [ ] Implement localStorage-based preference storage
- [ ] Prompt to create account after N recommendations
- [ ] Migrate localStorage data to Firestore on signup

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
