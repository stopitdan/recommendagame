# Recommend a Game — Master TODO

Last updated: 2026-03-26

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
- ✅ Word & Party Games Dataset (47 games)
- ✅ Supabase Database + Schema
- ✅ BGG Kaggle Import (22k games)
- ✅ BGG Live API Crawler (scanning 400k IDs)
- ✅ RAWG Crawler (80k+ games)

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
- ✅ Layer 1: Rule-Based Scoring (9 dimensions)
- ✅ Layer 2: Content-Based Filtering (pgvector, 26.5k embeddings)
- ✅ Layer 3: Collaborative Filtering
- ✅ Layer 4: Feedback Loop
- ✅ Hybrid Engine (rule-based 60% + similarity 40%)
- ✅ Progressive Fallback (never 0 results)
- ✅ SimilarTo Game Resolution (DB lookup from LLM output)

## Phase 5: Polish & Delight — ✅ Complete
- ✅ Game Night Glow Color Theme
- ✅ Animated Landing Page (motion parallax, stagger reveals)
- ✅ 3D D20 Dice Roller (physics-correct, nat 20 confetti, nat 1 blood)
- ✅ Loading Skeletons
- ✅ Dark Mode (system default + toggle + localStorage)
- ✅ Pluggable Color Preset System (6 themes)
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
- 📋 Color Theme Picker in Settings UI
- 📋 Iconography & Less Text

## Phase 6: Growth & Monetization — 📋 Planned
- ✅ Vercel Deployment
- ✅ Share Game Night Invite (/invite page + share button)
- 📋 Custom Domain (Squarespace → Vercel)
- 📋 Shareability & Social Cards (Open Graph previews)
- 📋 AI-Generated Blog / Game News
- 📋 Google Ads Integration
- 📋 Email Validation
- 📋 Marketing Plan (SEO, Reddit, BGG forums)
- 📋 Help Desk / Bug Reporting
- 🔮 Weekly Digest Email

## Phase 7: Fun Gimmicks & Engagement — Partial
- ✅ Achievement System (43 achievements, all wired)
- 🔮 D20 Dice Skin System (custom uploads, sharing, leaderboard)
- 🔮 Spin the Wheel Randomizer
- 🔮 Daily Game Pick (Wordle-style)
- 🔮 Game Night Playlist Generator
- 🔮 Game Night Timer
- 🔮 "What Should WE Play?" (multi-player room code)

## Phase 8: Recommendation Quality — 📋 Planned
- 📋 "Not This" Button (thumbs-down + learn)
- 📋 "More Like This" Button
- 📋 Preference Learning Banner

## Phase 9: Advanced Intelligence — 📋 Planned
- 📋 Better Video Game Data Source (IGDB/Steam)
- 📋 pgvector Primary Retrieval
- 📋 Advanced LLM Intelligence
- 🔮 Conversational Recommendations
- 🔮 Game Group Matching
- 🔮 Trending / Seasonal Recommendations
- 🔮 Import BGG / Steam Library
- 📋 Caching Layer (Redis)
- 🔮 Tech Stack Diagram
- 🔮 FAQ / Tutorial Page

## Untracked / Ongoing
- 📋 Shared component refactor audit
- 📋 More test coverage
- 🔄 BGG API crawler (ingesting 400k games)
