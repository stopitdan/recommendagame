# Architecture Decision Records

Document key decisions, the context behind them, and alternatives considered. This helps future-us understand *why* things are the way they are.

---

## ADR-001: Use Firebase for Auth and User Data

**Date:** 2026-03-24
**Status:** Accepted

**Context:** Need user authentication and a place to store user profiles, preferences, and recommendation history. Options considered:
- **Firebase** — Auth + Firestore in one package, generous free tier, good Next.js support
- **Supabase** — Postgres-based, more SQL-friendly, also has auth
- **NextAuth.js + separate DB** — More control but more setup

**Decision:** Firebase. It's the fastest path to working auth + storage with minimal infrastructure. Firestore's document model fits our user profile data well (nested preferences, arrays of liked games, etc.).

**Tradeoffs:** Vendor lock-in with Google. If we outgrow Firestore's querying capabilities (especially for collaborative filtering), we may need to add a separate database later.

---

## ADR-002: Adapter Pattern for Game Data Sources

**Date:** 2026-03-24
**Status:** Accepted

**Context:** We're pulling from multiple APIs with wildly different formats (BGG returns XML, RAWG returns JSON, word games may be local data). Need a clean way to add/remove sources.

**Decision:** Each data source gets an adapter class implementing a common interface (`GameAdapter`). Adapters handle all source-specific logic (parsing, auth, rate limiting). The rest of the app only works with the unified `Game` type.

**Tradeoffs:** Slight overhead in mapping every field. Worth it for decoupling.

---

## ADR-003: Start with Rule-Based Recommendations, Add ML Later

**Date:** 2026-03-24
**Status:** Accepted

**Context:** Building a "smart" recommendation engine is the goal, but ML models need training data we don't have yet.

**Decision:** Ship with weighted rule-based scoring first (match user preferences to game attributes, score and rank). Layer on content-based filtering once we have enough game metadata indexed. Add collaborative filtering only after we have a meaningful user base.

**Tradeoffs:** Early recommendations won't feel as "magical" as a trained model. But they'll be useful from day one, and the feedback loop will generate training data for later.

---

## ADR-004: Guest-First UX

**Date:** 2026-03-24
**Status:** Accepted

**Context:** Requiring signup before getting any value is a conversion killer.

**Decision:** Users can go through the full questionnaire and get recommendations without logging in. Auth is only needed to save preferences, history, and favorites. Guest state stored in localStorage.

**Tradeoffs:** Slightly more complex state management (localStorage + Firestore). Worth it for better UX.

---

## ADR-005: BGG Rate Limiting Strategy — Cache Now, Mirror Later

**Date:** 2026-03-24
**Status:** Accepted

**Context:** BGG XML API has a hard rate limit of ~1 request per 5 seconds with no paid tier. This is too slow for a production app serving real-time user searches.

**Decision:** Two-phase approach:
1. **Now:** Build the BGG adapter with aggressive caching (long TTLs). Good enough for development and early users.
2. **Later:** Set up a local database mirror (likely Firestore) with a cron job that incrementally syncs BGG data. The app queries our copy with zero rate limits.

The adapter is needed either way — it's how both the cache and the cron job fetch data from BGG. Building it now is not wasted work.

**Tradeoffs:** Phase 1 means some searches will be slow on cache miss. Acceptable for now. Phase 2 adds infrastructure complexity but is required for production scale.

---

## ADR-006: Supabase (PostgreSQL + pgvector) Replaces Firebase for Everything

**Date:** 2026-03-24
**Status:** Accepted (supersedes ADR-001)

**Context:** Originally planned Firebase Auth + Firestore. But the recommendation engine needs vector similarity search (cosine distance on game attribute vectors) which Firestore cannot do. Options considered:
- **Firestore + separate vector DB (Pinecone/Weaviate)** — Two services, more complexity, more cost
- **Supabase (PostgreSQL + pgvector)** — One service does it all: auth, relational data, AND vector search
- **Self-hosted Postgres** — Maximum control, but ops burden

**Decision:** Supabase for everything — auth, game data storage, user profiles, and vector similarity search via pgvector. This gives us:
- **pgvector** for cosine similarity search on game embeddings (how recommendations work)
- **Full SQL** for complex queries (collaborative filtering, analytics, JOINs)
- **Built-in auth** with email/password + OAuth providers
- **Row Level Security** for user data isolation
- Hosted with zero ops, generous free tier, paid tiers scale well

**Vector strategy:** Each game gets a feature vector (768 dimensions) encoding its attributes (categories, mechanics, complexity, player count, etc.). User preferences also become vectors. Recommendations = nearest neighbor search between user vector and game vectors.

**Tradeoffs:** Moves off GCS ecosystem. Supabase is newer than Firebase with a smaller community. PostgreSQL requires schema migrations (vs Firestore's schemaless approach). All acceptable given the massive capability gain for the recommendation engine.
