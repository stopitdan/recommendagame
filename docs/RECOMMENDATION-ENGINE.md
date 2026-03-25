# Recommendation Engine — Design & Roadmap

How Recommend a Game evolves from basic filtering to a true ML-powered recommendation engine.

---

## The Four Layers (in order of implementation)

### Layer 1: Weighted Scoring (Phase 3 — NOW)
**What it is:** User answers questionnaire → structured preferences → query DB with weighted scoring.

Not just `WHERE min_players >= 3`. Each game gets a **match score** across all preference dimensions (type, player count, time, complexity, genres, mood). Games are ranked by total score.

**Example:** User wants 4 players, medium complexity, strategy genre.
- Catan: 4-player ✓ (+3), complexity 2.3 (close to medium) (+2), Strategy ✓ (+3) = **score 8**
- Wordle: 1-player ✗ (+0), complexity 1.5 (too simple) (+1), Puzzle (not Strategy) (+0) = **score 1**

**Smarter than filtering because:** A game that matches 4/5 criteria still surfaces. Pure filtering would exclude it for missing one criterion.

**Infrastructure needed:** Already built — questionnaire (collecting), Supabase queries (scoring).

---

### Layer 2: Content-Based Filtering via pgvector (Phase 4a)
**What it is:** Each game's attributes are encoded as a **768-dimensional vector**. User preferences become a vector in the same space. Recommendations = **cosine similarity** (nearest neighbor search).

**How it works:**
1. Build a feature vector for each game from its metadata:
   - Categories → one-hot encoded dimensions
   - Mechanics → one-hot encoded dimensions
   - Complexity → normalized value
   - Player count range → encoded
   - Play time → encoded
   - Rating → encoded
2. Store in `game_embeddings` table (already exists)
3. Convert user preferences into a vector in the same space
4. Call `match_games()` RPC (already exists) — pgvector finds nearest neighbors via HNSW index

**Why this is real ML:** This is the same approach used by Spotify (for songs), Netflix (for shows), and Amazon (for products). Cosine similarity in a shared embedding space is the foundation of modern recommendation systems.

**Infrastructure needed:** Already built — `game_embeddings` table, `match_games()` RPC, HNSW index. Need to build: the embedding generation pipeline (game attributes → vector).

---

### Layer 3: Collaborative Filtering (Phase 4c)
**What it is:** "Users who liked X also liked Y." Learns from **collective user behavior**, not just game metadata.

**How it works:**
1. Build a user-game interaction matrix from `user_game_feedback` (thumbs up/down)
2. Find users with similar feedback patterns
3. Recommend games that similar users liked but the current user hasn't seen

**Two approaches:**
- **User-based:** Find similar users, recommend what they liked
- **Item-based:** Find games similar to ones the user liked (based on who else liked them)

**Why this matters:** Discovers non-obvious connections. A user who likes both Catan and Wordle might get recommended Codenames — a connection that content-based filtering wouldn't make, but collaborative filtering learns from user behavior.

**Infrastructure needed:** Already built — `user_game_feedback` table. Need to build: matrix factorization or a lightweight collaborative filtering algorithm. Needs a **minimum user base** (~50-100 users with feedback) before it produces useful signals.

---

### Layer 4: Hybrid + LLM Enhancement (Phase 4d-e)
**What it is:** Combine all three layers with learned weights, plus natural language understanding.

**Hybrid scoring:**
```
final_score = w1 * rule_score + w2 * content_similarity + w3 * collaborative_score
```
Weights adjust based on data availability:
- New user, no feedback → heavy on rule_score and content_similarity
- Established user with feedback → collaborative_score gets more weight
- Cold start (new game, no ratings) → content-based only

**LLM enhancement:**
- Parse free-text input: "something like Catan but faster and for 2 players" → structured preferences + boost for Catan-similar games
- Generate "why we picked this" explanations: "Because you like strategy games with moderate complexity, and 80% of users who liked Catan also loved this one"
- Eventually: conversational recommendations ("What about something cooperative instead?")

**Infrastructure needed:** LLM API integration (Claude), prompt engineering, hybrid scoring function.

---

## The Feedback Loop (what makes it LEARN)

This is what ties everything together:

```
User answers questionnaire
        ↓
Gets recommendations (Layer 1 + 2)
        ↓
Thumbs up / thumbs down
        ↓
Feedback stored in user_game_feedback
        ↓
User's preference_vector updated (gets closer to liked games, farther from disliked)
        ↓
Next recommendation is better
        ↓
Meanwhile, collaborative filtering sees patterns across ALL users
        ↓
System gets smarter globally, not just per-user
```

Every interaction makes the system better for that user AND for all users.

---

## What's Already Built (infrastructure)

| Component | Status | Where |
|-----------|--------|-------|
| `game_embeddings` table (768-dim vectors) | Schema ready | `001_initial_schema.sql` |
| `match_games()` RPC (cosine similarity) | Schema ready | `001_initial_schema.sql` |
| HNSW index for fast vector search | Schema ready | `001_initial_schema.sql` |
| `user_preferences.preference_vector` | Schema ready | `001_initial_schema.sql` |
| `user_game_feedback` table (thumbs up/down) | Schema ready | `001_initial_schema.sql` |
| Questionnaire UI (data collection) | Building now | Phase 3 |
| Embedding generation pipeline | Not started | Phase 4a |
| Collaborative filtering algorithm | Not started | Phase 4c |
| Hybrid scoring + LLM | Not started | Phase 4d-e |

---

## Key Decisions

- **768 dimensions** for embeddings — good balance of quality and performance
- **Cosine similarity** (not Euclidean) — better for sparse, high-dimensional data
- **HNSW index** — approximate nearest neighbor, sub-100ms at 100k+ games
- **Supabase/pgvector** — keeps everything in one DB, no separate vector service
- **Progressive complexity** — each layer adds on top of the previous, nothing wasted
