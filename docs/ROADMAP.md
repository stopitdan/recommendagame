# Roadmap

High-level phases for boredgame.lol. Each phase builds on the last — order matters.

---

## Phase 1: Data Layer & Game APIs
**Status:** Not Started
**Goal:** Fetch, normalize, and cache game data from multiple sources into a unified schema.

- Define a universal `Game` type that works across board games, video games, and word games
- Build API adapters for each data source (BGG, RAWG, etc.)
- Implement caching to avoid hammering rate-limited APIs
- Create a unified search/query service

**Exit criteria:** Can search for a game by name and get normalized results from multiple sources.

---

## Phase 2: Auth & User Profiles
**Status:** Not Started
**Goal:** Let users create accounts, log in, and persist their preferences and history.

- Firebase Auth (email/password + Google OAuth)
- User profile storage in Firestore (preferences, history, favorites)
- Guest mode with localStorage fallback
- Prompt guests to sign up to save progress

**Exit criteria:** Users can sign up, log in, and have their profile persisted across sessions.

---

## Phase 3: Questionnaire & Filter UI
**Status:** Not Started
**Goal:** Give users a way to express what kind of game they want.

- Multi-step onboarding questionnaire (game type, player count, time, complexity, genres, mood)
- Filter sidebar for returning users who want to skip the questionnaire
- Results page with card-based game recommendations

**Exit criteria:** A user can answer questions and see a filtered list of games.

---

## Phase 4: Recommendation Engine
**Status:** Not Started
**Goal:** Go from basic filtering to genuinely smart recommendations.

- **4a:** Rule-based weighted scoring (matches preferences to game attributes)
- **4b:** Content-based filtering (recommend games similar to ones the user liked)
- **4c:** Collaborative filtering (users who liked X also liked Y — needs user base)
- **4d:** Hybrid engine combining all approaches
- Feedback loop: thumbs up/down on recommendations feeds back into scoring

**Exit criteria:** Recommendations feel personalized and improve over time with user feedback.

---

## Phase 5: Polish & Production Readiness
**Status:** Not Started
**Goal:** Make it feel like a real product.

- Individual game detail pages
- Favorites / "play later" lists
- Responsive mobile-first design
- Rate limiting, error handling, graceful API degradation
- Analytics (what gets recommended vs. clicked vs. liked)
- SEO and performance optimization

**Exit criteria:** App is deployable and usable by real people.

---

## Future Ideas (unscoped)

- Social features (share recommendations, see what friends are playing)
- Discord bot integration
- "Game night planner" mode (input your group, get a curated session)
- Price comparison / where-to-buy links
- Seasonal/trending recommendations
