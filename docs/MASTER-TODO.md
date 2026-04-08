# boredgame.lol — Master TODO

Last updated: 2026-04-07

## Legend
- ✅ Done
- 🔄 In Progress
- 📋 Planned
- 🔮 Future

---

## Phase 1: Foundation & Data Pipeline — ✅ Complete
- ✅ Unified Game schema
- ✅ BGG Adapter (XML API)
- ✅ RAWG Adapter (Video Games)
- ✅ IGDB Adapter (Video Games — richer metadata)
- ✅ Word & Party Games Dataset (47 games)
- ✅ Supabase Database + Schema
- ✅ BGG Kaggle Import (22k games)
- ✅ BGG Live API Crawler (scanning 400k IDs)
- ✅ RAWG Crawler (80k+ games)
- ✅ IGDB Crawler (20k+ games with rich genres/themes/keywords)
- ✅ RAWG→IGDB Deduplication (13k dupes removed)

## Phase 2: Auth & User System — ✅ Complete
- ✅ Supabase Auth (Email/Password)
- ✅ Google OAuth
- ✅ Profile Hub (stats, favorites, reviews, presets)
- ✅ Saved Preference Presets
- ✅ User Reviews & Ratings
- ✅ Favorites / Game Library
- ✅ Recommendation Settings
- ✅ Guest Mode (localStorage + signup prompt)
- ✅ Email Confirmation Flow

## Phase 3: Questionnaire & UI — ✅ Complete
- ✅ 7-Step Questionnaire Flow
- ✅ Multi-Select Game Types & Time
- ✅ Free Text Keyword Matching
- ✅ LLM-Powered Free Text Parsing (GPT-4o-mini)
- ✅ Results Page with "Why" Reasons
- ✅ Quick Collections on Landing Page
- ✅ Browse Page with Rich Filters
- ✅ Game Detail Pages
- ✅ Smart Questionnaire Filtering (hide irrelevant options)
- ✅ Player Count Single-Pick (conversational)
- ✅ "Find games →" Quick Submit
- ✅ Editable Search on Results Page

## Phase 4: Recommendation Engine — ✅ Complete
- ✅ Layer 1: Rule-Based Scoring (10 dimensions including recency)
- ✅ Layer 2: Content-Based Filtering (pgvector, enriched vectors)
- ✅ Layer 3: Collaborative Filtering
- ✅ Layer 4: Feedback Loop
- ✅ Hybrid Engine (rule-based 60% + similarity 40%)
- ✅ Hybrid Candidate Fetching (250 vector + 250 rating + tag + text search)
- ✅ Tag-Based Candidate Retrieval (GIN index lookup by category/mechanic/theme)
- ✅ Progressive Fallback (6 tiers deep, never 0 results)
- ✅ SimilarTo Game Resolution (DB lookup from LLM output)
- ✅ Diversity Re-ranking (MMR-based, prevents homogeneous results)
- ✅ Rejection Learning (penalizes patterns from "Not This" feedback)
- ✅ Recency Boost (newer games get mild freshness signal)

## Phase 5: Polish & Delight — ✅ Complete
- ✅ Game Night Glow Color Theme
- ✅ Animated Landing Page (motion parallax, stagger reveals)
- ✅ 3D D20 Dice Roller (physics-correct, nat 20 confetti, nat 1 blood)
- ✅ Loading Skeletons
- ✅ Dark Mode (system default + toggle + localStorage)
- ✅ Pluggable Color Preset System (6 themes)
- ✅ Color Theme Picker in Settings UI
- ✅ Dark Mode Toggle in Settings UI
- ✅ Staggered Card Reveal Animation
- ✅ Rating Counter Animation
- ✅ Favorite Heart Micro-Animation (particle burst)
- ✅ Scroll Progress Indicator
- ✅ Page Transitions (fade-in)
- ✅ Themed Loading Animations (dice/cards/search)
- ✅ Parallax Game Art Headers
- ✅ Custom Tooltip Styles (500ms delay, descriptive)
- ✅ Nav Microanimations (emoji wiggle, hover lift)
- ✅ Responsive Polish
- ✅ Dice Emoji Favicon
- ✅ Game Type Labels (Board Game, Video Game, etc.)
- ✅ Match Percentage Badges on Results
- 📋 Iconography & Less Text

## Phase 6: Growth & Monetization — ✅ Complete
- ✅ Vercel Deployment
- ✅ Share Game Night Invite (/invite page + share button)
- ✅ Custom Domain (boredgame.lol via Cloudflare)
- ✅ Shareability & Social Cards (OpenGraph meta, dynamic OG images, share card API)
- ✅ AI-Generated Blog (2x daily via Vercel Cron, GPT-4.1, 710 topics, 6 formats)
- ✅ Google Ads Integration (AdSense script live, verification pending)
- ✅ Email Validation (Supabase email confirmation)
- ✅ Help Desk / Bug Reporting (/contact page + feedback widget)
- ✅ FAQ Page (/faq with 10+ common questions)
- ✅ Privacy Policy + Terms of Service
- ✅ Cookie Consent Banner
- ✅ GDPR Data Export & Deletion (in /settings)
- ✅ Amazon Affiliate Links (tag: boredgame-20)
- ✅ Google Analytics (G-5W6KCSVEJP)
- ✅ Sitemap + robots.txt (games sitemap paginated)
- ✅ JSON-LD Structured Data (WebSite, VideoGame/BoardGame schemas)
- ✅ Implicit Signal Collection (click tracking, dwell time, scroll depth)
- ✅ Automated Daily + Weekly Email Reports (via Resend + Vercel Cron)
- 📋 Marketing Plan (SEO, Reddit, BGG forums)
- 🔮 Weekly Digest Email (for users)

## Phase 7: Fun Gimmicks & Engagement — Partial
- ✅ Achievement System (43 achievements, all wired)
- ✅ Dice Creator (custom dice uploads and sharing)
- ✅ Daily Game Pick (deterministic high-rated game of the day)
- 🔮 Spin the Wheel Randomizer
- 🔮 Game Night Playlist Generator
- 🔮 Game Night Timer
- 🔮 "What Should WE Play?" (multi-player room code)

## Phase 8: Recommendation Quality — ✅ Complete
- ✅ "Not This" Button (thumbs-down + rejection learning)
- ✅ "More Like This" Button (re-search seeded with game attributes)
- ✅ Feedback API (upsert to user_game_feedback)
- ✅ Diversity Re-ranking (MMR algorithm)
- ✅ Recency Scoring Dimension
- ✅ Rejection-Based Learning
- ✅ Match Percentage Display
- 📋 Preference Learning Banner

## Phase 9: Advanced Intelligence — Partial
- ✅ Better Video Game Data Source (IGDB)
- ✅ pgvector Primary Retrieval (hybrid 250+250)
- ✅ Enriched LLM-Preference Vectors
- ✅ Advanced LLM Prompt (tone detection, intensity, expanded genres)
- ✅ Caching Layer (Redis via Upstash)
- ✅ OpenAI Semantic Embeddings module (ready, needs generation)
- ✅ Conversational Recommendations (/chat with GPT-4o function calling)
- ✅ Import BGG / Steam Library (sync endpoints + profile UI)
- ✅ FAQ / Tutorial Page (/faq)
- 🔮 Game Group Matching
- 🔮 Trending / Seasonal Recommendations

## Phase 10: Performance — Partial
- ✅ Kill all ILIKE queries (replaced with GIN-indexed tsvector RPCs)
- ✅ Partial indexes for browse patterns (7 indexes)
- ✅ Stored tsvector columns (name_tsv, description_tsv)
- ✅ Fuzzy search with pg_trgm (typo-tolerant fallback when tsvector returns 0 results)
- ✅ Shared GAME_SELECT_COLUMNS (23 cols vs 40+ from SELECT *)
- ✅ Timeout guards on parallel queries (8s per source)
- ✅ Pre-computed popularity cache in Redis (38 lists, 1390 games)
- ✅ Redis caching on recommend (2min), browse (5min), detail (10min), similar (10min)
- ✅ match_games RPC fix (removed WHERE clause defeating HNSW index)
- 📋 Semantic embedding generation (OpenAI text-embedding-3-small, ~$0.40)
- 📋 Meilisearch for browse/search (sub-100ms, $5-15/mo self-hosted)

## Phase 11: Scoring & Engine Improvements — ✅ Complete (April 2026)
- ✅ Fix cache key computed before LLM merge (Tier 1.1)
- ✅ Fix genre match 0.4 floor for zero matches (Tier 1.3)
- ✅ Fix denormalize() no-op in embeddings (Tier 1.2)
- ✅ Fix MMR diversity assumes sorted input (Tier 1.4)
- ✅ Fix time fit cliff-like falloff -> smooth exponential decay (Tier 1.5)
- ✅ Fix mechanic alias: social deduction no longer maps to "Voting" (Tier 2.6)
- ✅ Fix mechanic alias: engine building no longer maps to "Income" (Tier 2.7)
- ✅ Fix complexity null handling: penalize missing data when user set range (Tier 2.4)
- ✅ Increase quality signal weight 3% -> 5%, reduce recency 3% -> 1% (Tier 2.3)
- ✅ Fix Bayesian dampening for hidden gems mode (lower threshold) (Tier 2.2)
- ✅ Mood scoring: capped sub-signals, expanded tag mappings (Tier 2.1)
- ✅ Normalize designer/mechanic scoring imbalance (Tier 2.5)
- ✅ Favorites RLS UPDATE policy fix

## Bugs & Fixes
- ✅ Favorites RLS error — added UPDATE policy (migration 033)
- 📋 Finish Block 2 of migration 011 (tsvector columns may not have been created)

## Untracked / Ongoing
- 📋 Shared component refactor audit
- ✅ Test coverage (477 tests, 42 files)

## Scripts Reference
- `source .env.local && npx tsx scripts/generate-embeddings.ts 200` — hash embeddings
- `source .env.local && npx tsx scripts/generate-semantic-embeddings.ts` — OpenAI semantic embeddings (~$0.40)
- `source .env.local && npx tsx scripts/populate-popularity-cache.ts` — refresh Redis popularity cache
- `source .env.local && npx tsx scripts/check-embeddings.ts` — diagnostic: embedding coverage, RPC health
- `source .env.local && npx tsx scripts/crawl-igdb.ts` — IGDB video game crawler
- `source .env.local && npx tsx scripts/dedupe-rawg-igdb.ts` — remove RAWG dupes that exist in IGDB
