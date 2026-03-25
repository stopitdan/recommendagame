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
