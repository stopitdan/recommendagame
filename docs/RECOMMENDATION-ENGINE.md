# Recommendation Engine -- Current State & Design

How boredgame.lol recommends games. This document describes the system as it exists today, including what's implemented, what's working, and what's not.

For the research that informed these decisions, see [RECOMMENDATION-ENGINE-RESEARCH.md](RECOMMENDATION-ENGINE-RESEARCH.md).
For the comprehensive review packet, see [TECHNICAL-REVIEW-PACKET.md](TECHNICAL-REVIEW-PACKET.md).

---

## The Four Layers

The recommendation engine evolved through four layers. All four are implemented; Layer 3 (Collaborative Filtering) is infrastructure-complete but data-starved.

### Layer 1: Weighted Rule-Based Scoring (ACTIVE)

User answers questionnaire or types free text. Preferences are extracted and matched against game metadata across 10 weighted dimensions:

| Dimension | Weight | What It Scores |
|-----------|--------|---------------|
| Genre match | 26% | User genres vs. game categories/mechanics/themes (70-entry expansion map) |
| Free text match | 22% | LLM-parsed keywords, mechanics, designers matched against game metadata |
| Type match | 10% | Board game vs. video game |
| Player count fit | 8% | Does the game support the requested player count? |
| Mood alignment | 8% | Mood tags (chill, competitive, etc.) vs. enriched metadata + heuristics |
| Time fit | 7% | Game play time vs. user time preference |
| Complexity fit | 7% | BGG weight rating vs. user complexity preference |
| Popularity | 6% | Rating count (Bayesian adjusted) -- ensures canonical games surface |
| Quality | 3% | Average user rating (Bayesian adjusted) |
| Recency | 3% | Publication year boost |

**Adaptive weights:** The base weights are amplified based on query specificity. A user who says "exactly 2 players" gets a 2x boost on player count; "under 90 minutes" gets 2.5x on time. Broad queries with few constraints get 6x on quality/popularity as a tiebreaker. Multi-constraint queries (3+) get a popularity floor of 5% to ensure canonical games break ties. All weights renormalize to 100% after amplification.

**Intent modifiers:** The LLM parser extracts intent levels from free text:
- "must have" -> +0.3 bonus when matched, -0.2 penalty when missing
- "avoid" / "not too" -> -0.25 penalty when matched
- "really" / "very" -> +0.15 bonus
- "ideally" / "bonus if" -> +0.1 bonus (no penalty for missing)

**File:** `src/lib/recommendation/scoring.ts` (1,230 lines)

---

### Layer 2: Content-Based Filtering via pgvector (ACTIVE)

Each game has two vector representations stored in `game_embeddings`:
- **Hash-based (768-dim):** One-hot encoded categories, mechanics, themes, normalized complexity/players/time. Used as fallback.
- **Semantic (1536-dim):** OpenAI text-embedding-3-small embeddings of game name + description + metadata. **100% coverage (81,039 games).**

User preferences become a vector in the same space. The pgvector HNSW index finds the 250 nearest neighbors by cosine similarity in sub-100ms.

After rule-based scoring, the top 100 candidates are re-ranked with a blended score:
```
final_score = 0.65 * rule_score + 0.35 * cosine_similarity
```
The blend is shifted toward rules (was 55/45) because cosine similarity rewards tag-matching obscure games equally with famous ones. The rule-based scoring includes popularity tiebreakers and adaptive weights that better surface canonical games for broad queries.

**Files:** `src/lib/recommendation/similarity.ts`, `src/lib/recommendation/embeddings.ts`

---

### Layer 3: Collaborative Filtering (INFRASTRUCTURE READY, DATA-STARVED)

Two implementations exist:

**Frequency-based CF (active):** Finds users with similar feedback patterns, boosts games they liked. Minimum 3 reviews per user to activate. Gives +15% score boost. Simple but effective for small data.

**BPR -- Bayesian Personalized Ranking (ready, not active):** Full TypeScript implementation of Rendle et al. (UAI 2009). Learns 64-dimensional latent factor vectors for users and games via SGD on (user, liked_game, disliked_game) triples. Needs sufficient user feedback data to train. This is THE algorithm recommended by academic literature for implicit feedback (thumbs up/down).

**Why CF matters:** Content-based filtering says "you like strategy games, here's another strategy game." Collaborative filtering says "users with your taste pattern also loved this game you've never heard of." They produce non-overlapping recommendations (validated by BGG academic study).

**Files:** `src/lib/recommendation/collaborative.ts`, `src/lib/recommendation/bpr.ts`

---

### Layer 4: Hybrid + LLM Enhancement (ACTIVE)

The final ranking combines all signals:

```
base_score = 0.55 * rule_score + 0.45 * similarity_score
boosted_score = base_score * (1 + CF_boost)  // +15% when CF data exists
penalized_score = boosted_score * (1 - rejection_penalty)  // from "Not This" history
```

Then the LLM reranker (GPT-4o) takes the top 80 candidates, considers the user's original query semantically, and outputs the top 25 in its preferred order. Notable well-known games (20k+ ratings) in the candidate pool are highlighted to the LLM so it can promote them even if they ranked lower in rule-based scoring.

Finally, MMR diversity enforcement (88% relevance + 12% novelty) prevents the top 30 from being too homogeneous. The lambda was reduced from 0.2 to 0.12 because the higher value was demoting relevant canonical games that shared tags (e.g., multiple deck builders for a "deck building" query).

**LLM enhancement points:**
1. **Parsing:** Free text -> structured preferences with intent modifiers
2. **Query expansion:** Generates 5-10 creative search terms for broader candidate retrieval
3. **Re-ranking:** Semantic understanding catches what rule-based scoring misses
4. **Metadata enrichment (batch):** GPT-4o-mini generates mood/vibe/audience tags for all 81k games

This aligns with the 2024-2025 industry consensus: LLMs should enhance traditional rec systems, not replace them.

---

## Candidate Sources (7 parallel)

The engine fetches candidates from 7 sources in parallel, then deduplicates with priority ordering:

| Priority | Source | Max Games | What It Finds |
|----------|--------|-----------|---------------|
| 1 | Canonical games | ~10 | Editorial overrides: universally-expected games for 30+ mechanics/categories (Dominion for deck building, Codenames for party). Netflix/Spotify pattern. |
| 2 | Designer search | 50/designer | Case-insensitive substring match on designers array |
| 3 | Mechanic search | 100 | Direct BGG mechanic matches via alias map (50+ user terms -> BGG names) |
| 4 | Vector search | 250 | Semantic nearest neighbors via pgvector HNSW index |
| 5 | Tag search | 150 | GIN-indexed category/mechanic/theme overlaps |
| 6 | Text search | 60 | Full-text search on name + description |
| 7 | LLM expansion | 50 | Creative search terms generated by GPT-4o-mini |

**Popularity fallback:** Only if sources 1-7 yield fewer than 30 games. Prevents popular-but-irrelevant games (UNO, Catan) from polluting niche queries.

**File:** `src/app/api/recommend/route.ts`

---

## The Feedback Loop

Every interaction makes the system better:

```
User answers questionnaire
        |
Gets recommendations (Layers 1-4)
        |
Thumbs up / "Not This"
        |
user_game_feedback table updated
        |
    +---+---+
    |       |
Preference vector    Rejection learning
updated (closer to   builds tag profile
liked games)         from dismissed games
    |                (activates after 2+
Next recommendation  rejections of same tag,
is better            max 50% penalty)
    |
Meanwhile: CF sees patterns across ALL users
    |
System gets smarter globally
```

**Files:** `src/lib/recommendation/feedback-loop.ts`, `src/lib/recommendation/rejection.ts`

---

## Evaluation

The engine is measured by a 3,028-case eval suite across 16 categories. See [evals/EVAL-OVERVIEW.md](../evals/EVAL-OVERVIEW.md) for full details.

**Current baseline (307-case subset):**
- 68.4% pass rate
- 7.14/10 LLM judge score
- 0.9855 NDCG@10
- 1.0% constraint violations
- Best categories: Edge Cases (100%), Video Games (100%), Theme (86%)
- Worst categories: Mood/Vibe (29%), Mechanic-Focused (32%), Designer (42%)

**Known issues:**
1. **0.5% catalog coverage** -- only ~400 of 81k games ever get recommended
2. **Missing famous games** -- Dominion, Codenames, Azul rank below obscure alternatives
3. **Genre matching too fuzzy** -- 70 static expansions create false positives
4. **Static weights** -- should be learned, not hand-tuned (Koch/Criteo recommendation)

---

## Key Constants

| Parameter | Value | Notes |
|-----------|-------|-------|
| Vector pool size | 250 | Candidates from pgvector search |
| Relevance pool size | 150 | Candidates from tag/text search |
| Min candidates | 30 | Below this, popularity fallback kicks in |
| Rule/similarity blend | 65/35 | Shifted toward rules to surface canonical games |
| CF boost | +15% | When collaborative filtering data exists |
| Rejection cap | 50% | Maximum penalty from rejection learning |
| LLM rerank input | 80 | Candidates sent to LLM reranker (was 60) |
| LLM rerank output | 25 | Candidates returned by LLM reranker |
| Diversity lambda | 0.12 | MMR: 88% relevance, 12% novelty (was 0.2) |
| Cache TTL | 120s | Both Redis and in-memory |
| LLM parse timeout | 8s | GPT-4o-mini preference extraction |
| LLM rerank timeout | 12s | GPT-4o semantic reranking |

---

## Architecture vs. Literature

See [RECOMMENDATION-ENGINE-RESEARCH.md](RECOMMENDATION-ENGINE-RESEARCH.md) for the full analysis. Key alignment points:

| Best Practice | Our Implementation | Gap |
|---------------|-------------------|-----|
| Hybrid CF + content (Raza et al.) | 7 parallel candidate sources (vector, tag, text, mechanic, designer, LLM expansion, canonical) + multi-stage scoring | CF is data-starved |
| LLMs enhance, don't replace (2024-2025 consensus) | LLM for parsing + reranking + enrichment | Aligned |
| Questionnaire for cold start (game-specific research) | Questionnaire-first architecture | Aligned |
| Diversity reduces churn (Spotify) | MMR with lambda=0.12 | Aligned |
| Popularity bias is #1 failure (Koch/Criteo) | Popularity at 6% + 6x broad-query tiebreaker + canonical game injection | Addressed |
| Editorial overrides (Netflix/Spotify) | Canonical games map for 30+ mechanics/categories | Aligned |
| Learned blending weights (Koch) | Static hand-tuned weights with query-adaptive amplification | Gap: need meta-learner |
| A/B testing (Netflix, Koch) | Offline eval + A/B framework (built, not yet wired) | Gap: not yet live |
| BPR for implicit feedback (Rendle et al.) | Implemented, not active | Gap: needs user data |
