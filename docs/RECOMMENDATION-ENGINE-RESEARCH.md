# Recommendation Engine Research: Diagnosis & Improvement Plan

## Context

Users report that game recommendations don't match their search input well. This document is a comprehensive research analysis comparing our current engine against academic literature, industry best practices, and game-specific recommendation research. The goal: identify where our pipeline loses signal, and what techniques would most improve recommendation quality for our specific use case (recommending board and video games based on user text input and structured preferences).

**Sources analyzed:**
1. Raza et al. (2024) "A Comprehensive Review of Recommender Systems" (arXiv 2407.13699) - 287 papers surveyed
2. Koch (2022) "Building a Recommendation Engine from Scratch" - Practitioner perspective from 6 years at Criteo
3. Forrester (2023) "Recommended Recommenders" - Industry analyst framework
4. hongleizhang/RSPapers - Curated academic paper collection (300+ papers)
5. hongleizhang/RSAlgorithms - Open-source algorithm implementations
6. Additional research: BGG-specific studies, Steam recommendation research, LLM+RecSys papers (2024-2025), Eugene Yan's practical LLM-for-RS analysis
7. Complete reading of our own codebase: all 9 recommendation module files, API route, LLM parsing, tests, eval suite, database schema

---

## Part 1: How Our Engine Currently Works

### Architecture Diagram

```
User Input (free text + questionnaire selections)
         |
         v
[LLM PARSING] GPT-4o-mini extracts ParsedPreferences
  - gameTypes, genres, mechanics, moods, complexity,
    playerCount, timePresets, similarTo, keywords,
    designers, excludedGenres, excludedMechanics
         |
         v
[CANDIDATE GENERATION] 6 parallel retrieval strategies (~500-1000 games)
  |-- Rating-based: 125 by quality + 125 by popularity
  |-- Vector search: 250 via pgvector (semantic or hash)
  |-- Text search: up to 50 via full-text on name/description
  |-- Tag search: up to 150 via GIN index on categories/mechanics/themes
  |-- Mechanic search: up to 100 for LLM-parsed mechanics
  |-- Designer search: up to 100 for LLM-parsed designers
  |-- LLM query expansion: up to 50 creative search terms
         |
         v
[HARD CONSTRAINT FILTERING]
  |-- Player count (mandatory overlap)
  |-- Time (grace buffer: 15min hard, 50% soft)
  |-- Complexity (+-0.5 unit buffer)
  |-- Game type (soft, falls back)
  |-- Single-mechanic hardness (if applicable)
  |-- Expansion/variant removal
         |
         v
[RULE-BASED SCORING] 10 weighted dimensions (0-1 each)
  | Dimension        | Default | Hidden Gems | High-Intent |
  |------------------|---------|-------------|-------------|
  | Genre match      |  0.20   |    0.22     |    0.10     |
  | Popularity       |  0.20   |    0.00     |    0.08     |
  | Free text match  |  0.14   |    0.16     |    0.45     |
  | Type match       |  0.10   |    0.10     |    0.10     |
  | Player count fit |  0.08   |    0.08     |    0.08     |
  | Mood alignment   |  0.08   |    0.08     |    0.08     |
  | Time fit         |  0.07   |    0.07     |    0.07     |
  | Complexity fit   |  0.07   |    0.07     |    0.07     |
  | Recency boost    |  0.03   |    0.05     |    0.03     |
  | Quality signal   |  0.03   |    0.15     |    0.02     |
         |
         v
[SIMILARITY RE-RANKING] top 100 candidates
  85% rule-based score + 15% cosine similarity
         |
         v
[COLLABORATIVE FILTERING BOOST] +15% for CF signals
  (only when user has feedback history)
         |
         v
[REJECTION LEARNING] penalty for rejected-tag matches
  score *= (1 - rejection_penalty), capped at 0.8
         |
         v
[LLM RE-RANKING] GPT-4o-mini picks top 10-15 from top 40-50
  Semantic understanding of "what user actually wants"
         |
         v
[DIVERSITY RE-RANKING] MMR algorithm (lambda=0.2)
  80% relevance + 20% novelty, applied to top 30
         |
         v
Output: scored games with reasons + breakdown
```

### Key Numerical Constants

| Parameter | Value | Concern Level |
|-----------|-------|---------------|
| Candidate pool | ~500-1000 | Adequate |
| Hard filter output | ~300-500 | May be too aggressive |
| Similarity threshold | 0.15 | Very permissive (good) |
| CF minimum feedback | 3 reviews | Low bar but CF rarely activates |
| Feedback learning rate | 0.15 | Reasonable |
| Diversity lambda | 0.2 | Conservative (good) |
| LLM rerank timeout | 6s | Tight for quality |
| LLM parse timeout | 8s | Adequate |
| Bayesian confidence | 1000 votes | Reasonable |
| Semantic embedding coverage | ~23% of 81k games | CRITICAL GAP |

---

## Part 2: Literature Review Findings

### 2.1 The Arxiv Survey (Raza et al., 287 papers)

**Key finding:** The state of the art has moved decisively toward hybrid systems. No single technique wins. The paper's general framework pipeline (Fig. 2) matches our architecture well:

1. Data acquisition -> 2. Feature engineering -> 3. Candidate generation -> 4. Ranking -> 5. Evaluation -> 6. Feedback loop

**What the research says works best:**
- **GNN-based approaches** (LightGCN, PinSage) are SOTA for production collaborative filtering
- **Self-supervised contrastive learning** dramatically improves embedding quality in sparse data
- **Hybrid weighted combination** (`alpha * f_CB + beta * f_CF`) is validated as the right pattern
- **Matrix factorization** (SVD, ALS, BPR) remains strong for implicit feedback
- **LLMs enhance but don't replace** traditional signals

**Critical equation from the paper:**
```
r_hat_ui = alpha * f_CB(u,i; Theta_CB) + beta * f_CF(u,i; Theta_CF)
```
Our system implements this as: `0.85 * rule_score + 0.15 * similarity_score`, which is conceptually correct but the alpha/beta are static and hand-tuned rather than learned.

### 2.2 Koch (Criteo Practitioner, 6 years)

**Core philosophy: staged complexity.** Never jump to deep learning. Each stage must measurably beat the previous:

1. Most popular (baseline)
2. Previously viewed
3. Co-occurrence / pair counting
4. Matrix factorization
5. Deep learning (only if justified)

**Koch's most important insight for us:**
> "The mix matters. The best system is NOT a single algorithm but a fusion of multiple algorithms using a last-stage ML model (meta-learner)."

This directly challenges our fixed-weight approach. Koch would say: train a small model to learn the optimal blending weights from user feedback data, rather than hand-tuning them.

**Koch's second bomb:**
> "Collaborative filtering consistently outperforms content-based approaches. None of the best algorithms use product metadata."

Our system is ~70% content-based (genre, mood, complexity, type, time, free text) and ~15% collaborative. Koch's experience says this ratio should flip as we accumulate user data.

**Koch's third insight: A/B testing is non-negotiable.**
We have an eval suite (15% baseline on 743 cases) but no live A/B testing framework. Koch's recommended split: 5% baseline, 50% production, 45% experimental.

### 2.3 Forrester (Industry Analyst)

Lighter content, but validates our hybrid approach. Uses Twitter as case study showing production systems combine CF + deep learning + community clustering. Their taxonomy maps to our layers:
- CF -> our `collaborative.ts`
- Content-based -> our `scoring.ts` + `similarity.ts`
- Deep learning/NLP -> our `semantic-embeddings.ts`
- RL/feedback -> our `feedback-loop.ts`

### 2.4 Game-Specific Research

**BGG Study (Grannan):** Content-based and collaborative filtering produce **non-overlapping** recommendation sets. This validates our hybrid approach -- each layer catches games the other misses.

**Cold-Start Game Study:** A "Tags x Questions" hybrid model outperformed pure CF in cold-start settings. **This directly validates our questionnaire-first architecture.** Our questionnaire + tag-based scoring is the right approach for new users.

**Steam Study (Germain):** ALS with implicit feedback (playtime data) dramatically outperformed content-based and explicit rating approaches. Cold start was the unsolved problem. Takeaway: when we have enough implicit signals (what users click, save, play), those should dominate.

### 2.5 LLM + RecSys Research (2024-2025)

**The industry consensus has converged:** LLMs should enhance recommendation systems, not replace them.

Patterns that work:
- **LLM data enrichment** (Bing, Indeed, Spotify): Use LLMs to generate better metadata OFFLINE
- **Cache aggressively** (Yelp pre-computed 95% of LLM-enhanced traffic)
- **LLMs complement behavioral signals**, never replace them
- **Dense embeddings alone underperform**: YouTube found content embeddings were WORSE than random IDs without discretization

**Our current architecture (LLM for preference parsing + traditional scoring) aligns with what the research recommends.** But we should use LLMs more for offline data enrichment.

---

## Part 3: Diagnosis -- Where We Lose Signal

Based on comparing our implementation against the research, I've identified **7 specific failure modes** ordered by likely impact:

### FAILURE MODE 1: Free Text -> Structured Preferences Lossy Conversion (HIGH IMPACT)

**The problem:** When a user types "I want a game like Slay the Spire but longer and with more story," GPT-4o-mini extracts structured fields. But the extraction is lossy -- nuance, intensity, and the *relationships between preferences* are lost.

**Evidence:**
- The LLM prompt is good (generous extraction, negative preferences, typo handling)
- But the output is flat: `{genres: ["Roguelike"], mechanics: ["Deck Building"], similarTo: ["Slay the Spire"], keywords: ["story"]}`
- The "but longer" becomes `timePresets: ["long"]` which is a blunt instrument
- The "more story" becomes a keyword, not a primary requirement
- The *relationship* ("like X but different in Y") is lost entirely

**What research says:** Review-based recommendation systems (Section 12 in RSPapers) and conversational RS (Section 13) specifically address this. The key insight: preserve the user's intent structure, don't flatten it.

**Specific problem areas in our parsing:**
1. "Similar to X" extracts the game name but doesn't deeply leverage X's attributes
2. Intensity modifiers ("really want", "must have", "would be nice if") are lost
3. Comparative preferences ("like X but less Y") lose the comparison structure
4. The 70 genre expansions in scoring.ts create fuzzy matches that dilute specificity

### FAILURE MODE 2: Popularity Bias Drowns Niche Relevance (HIGH IMPACT)

**The problem:** Popularity signal has 20% weight in default mode. This means a game with 100k ratings that's a 60% genre match can outscore a game with 500 ratings that's a 95% genre match.

**Math proof:**
```
Game A: Popular but mediocre match
  genre=0.6 * 0.20 = 0.12
  popularity=0.95 * 0.20 = 0.19
  subtotal from these two = 0.31

Game B: Niche but perfect match
  genre=0.95 * 0.20 = 0.19
  popularity=0.3 * 0.20 = 0.06
  subtotal from these two = 0.25

Game A wins on these dimensions despite being less relevant.
```

**What research says:** Koch explicitly warns that popularity bias is the #1 failure mode in recommendation engines. The BGG study found content-based and CF produce non-overlapping results -- meaning popularity-biased CF misses the best content-based matches.

### FAILURE MODE 3: Genre/Tag Matching is Too Fuzzy (MEDIUM-HIGH IMPACT)

**The problem:** The 70 genre expansions in `scoring.ts` are well-intentioned but create false matches. "Strategy" expands to match games tagged "Abstract Strategy", "Economic", "Civilization" -- categories that a user asking for "strategy games" might not want.

**Specific issues:**
- Substring matching: "Strategy" matches "Abstract Strategy" (good) but also everything with "Strategy" anywhere in tags
- The 0.4 base score for genre match means even 0 matches still get 0.1 (with the no-match floor)
- Genre expansion aliases are static -- "roguelike" maps to `['adventure', 'variable player powers', 'modular board']` which is a BGG taxonomy mapping, not what users mean by "roguelike"

**What research says:** The arxiv survey emphasizes that knowledge graphs and semantic embeddings handle taxonomic relationships better than static alias tables. Our semantic embeddings (only 23% coverage) would solve this if they covered more games.

### FAILURE MODE 4: Semantic Embedding Coverage Gap (MEDIUM-HIGH IMPACT)

**The problem:** Only ~18.5k of 81k games have semantic embeddings (23% coverage). The fallback hash-based embeddings (768-dim one-hot) have high collision rates and zero semantic understanding.

**Impact:** For 77% of games, our vector search uses hash buckets that can't understand "build your deck" means "Deck Building." This means the 250 vector-search candidates are often irrelevant for the majority of the catalog.

**What research says:** The YouTube study found that content embeddings without proper semantic grounding performed WORSE than random IDs. Our hash embeddings may be actively hurting by returning false-positive similar games.

### FAILURE MODE 5: "Similar To" Doesn't Leverage Game Attributes (MEDIUM IMPACT)

**The problem:** When a user says "something like Catan," we extract `similarTo: ["Catan"]` and do a text/name search. But we don't systematically fetch Catan's attributes and use them to inform the search.

**What should happen:**
1. User says "like Catan"
2. System fetches Catan's full profile: {mechanics: ["Trading", "Resource Management", "Dice Rolling"], complexity: 2.3, players: 3-4, time: 60-120min, categories: ["Strategy", "Economic"]}
3. These attributes become ADDITIONAL scoring signals with high weight
4. Result: games that *play like* Catan, not just games that mention Catan

**Current behavior:** We have `similarTo` in free text matching, but it's matched against game names/descriptions, not used to bootstrap a preference profile from the target game's attributes.

### FAILURE MODE 6: Static Weights Can't Adapt to Query Type (MEDIUM IMPACT)

**The problem:** We have three weight profiles (default, hidden gems, high-intent) with a simple switch. But real queries exist on a spectrum.

**Examples of queries that need different weights:**
- "A game for my 6-year-old" -> complexity and age-appropriateness should dominate
- "What's the best 2-player game ever?" -> quality + player count should dominate
- "Something weird and unique" -> novelty + low popularity should dominate
- "A 20-minute filler game" -> time constraint should dominate

**What research says:** The arxiv survey discusses contextual bandits and reinforcement learning for dynamic weight adjustment. Koch recommends a trained meta-learner. Even without ML, we could have more query-type-specific weight profiles.

### FAILURE MODE 7: Collaborative Filtering is Effectively Dormant (LOW-MEDIUM IMPACT)

**The problem:** CF requires users with feedback history. With a young user base, CF signals are sparse. The minimum threshold is 3 reviews, but even then, the frequency-based scoring is primitive compared to matrix factorization (BPR, ALS, SVD++).

**What research says:** BPR (Bayesian Personalized Ranking) is THE algorithm for implicit feedback (thumbs up/down). Our frequency counting is equivalent to a "most popular among similar users" heuristic -- it works but misses the latent factor structure that MF captures.

---

## Part 4: Ranked Improvement Recommendations

### Tier 1: High Impact, Moderate Effort

#### 1.1 Complete Semantic Embedding Coverage
**What:** Generate OpenAI text-embedding-3-small vectors for all 81k games (batch job).
**Why:** Fixes Failure Mode 4. At ~$0.40 total cost, this is the highest-ROI improvement. Eliminates the hash-based fallback that produces false-positive matches.
**How:** Batch script, run weekly to catch new games. Store in `game_embeddings.semantic_embedding`.
**Expected impact:** 30-50% improvement in vector candidate quality.
**Files:** `src/lib/recommendation/semantic-embeddings.ts`, new batch script

#### 1.2 "Similar To" Attribute Bootstrapping
**What:** When user says "like X," fetch X's full game profile and inject its attributes as high-weight preference signals.
**Why:** Fixes Failure Mode 5. Users who say "like Catan" expect games with Catan's *feel*, not games whose description mentions Catan.
**How:**
1. In the API route, when `parsedPreferences.similarTo` is non-empty, fetch each game's full record
2. Extract its categories, mechanics, themes, complexity, player count, time
3. Merge these into the scoring context with a configurable boost weight
4. Use the game's embedding for vector search (find nearest neighbors directly)
**Expected impact:** 20-40% improvement for "similar to" queries (a common query pattern).
**Files:** `src/app/api/recommend/route.ts`, `src/lib/recommendation/scoring.ts`

#### 1.3 Reduce Popularity Weight, Increase Relevance Weight
**What:** Rebalance default weights: popularity 0.20 -> 0.12, genre 0.20 -> 0.24, freeText 0.14 -> 0.18.
**Why:** Fixes Failure Mode 2. Currently, Catan/Ticket to Ride/Pandemic dominate results regardless of query. Shifting 8 percentage points from popularity to relevance signals means niche-but-perfect matches can surface.
**How:** Update `DEFAULT_WEIGHTS` in `scoring.ts`. A/B test against current weights.
**Expected impact:** 15-25% improvement in perceived relevance, especially for specific queries.
**Files:** `src/lib/recommendation/scoring.ts`

### Tier 2: High Impact, Higher Effort

#### 2.1 Query-Adaptive Weight Profiles
**What:** Instead of 3 static profiles, analyze the parsed preferences to dynamically compute weights based on what the user emphasized.
**Why:** Fixes Failure Mode 6. A query about "the best 2-player game" should weight player count and quality much higher than genre.
**How:**
```
Rules engine:
- If playerCount specified and range <= 2: playerCountFit weight *= 2.0
- If maxMinutes specified with hard strictness: timeFit weight *= 2.5
- If complexity specified and range <= 1: complexityFit weight *= 2.0
- If similarTo non-empty: freeTextMatch weight *= 2.0, genreMatch *= 0.5
- If moods include "chill" or "social": moodAlignment weight *= 2.0
- Renormalize all weights to sum to 1.0
```
**Expected impact:** 20-30% improvement across diverse query types.
**Files:** `src/lib/recommendation/scoring.ts`, `src/app/api/recommend/route.ts`

#### 2.2 LLM-Powered Offline Game Metadata Enrichment
**What:** Use GPT-4o to generate richer, standardized metadata for all 81k games in a batch process.
**Why:** Many games have sparse metadata (missing mechanics, vague categories, no mood tags). If a game's only category is "Strategy" but it's actually a deck-building roguelike, our engine can't match it properly. LLM enrichment fills these gaps.
**How:**
1. Batch job: for each game, send name + description + existing tags to GPT-4o-mini
2. Extract: mood tags, refined mechanics, complexity estimate (if missing), target audience, similar games, "vibe" description
3. Store enriched metadata in a new `game_enriched` column or table
4. Use enriched data in scoring alongside original metadata
**Expected impact:** 15-30% improvement, especially for games with sparse BGG metadata.
**Cost:** ~$5-10 for 81k games at GPT-4o-mini pricing.
**Files:** New batch script, `src/lib/supabase/games.ts`, `src/lib/recommendation/scoring.ts`

#### 2.3 Preserve Intent Structure in Free Text Parsing
**What:** Enhance the LLM parsing to preserve comparative and conditional relationships, not just flat extraction.
**Why:** Fixes Failure Mode 1. "Like Catan but less random and more strategic" currently becomes `{similarTo: ["Catan"], excludedMechanics: ["Dice Rolling"], genres: ["Strategy"]}`. The *comparative structure* is lost.
**How:** Add new ParsedPreferences fields:
```typescript
interface ParsedPreferences {
  // ... existing fields ...
  intentModifiers: {
    mustHave: string[];      // "must have deck building"
    niceToHave: string[];    // "would be cool if it had story"
    avoid: string[];         // "not too random"
    emphasize: string[];     // "really strategic"
  };
  comparisonBase?: {
    game: string;            // "like Catan"
    keepAttributes: string[];  // "the trading"
    changeAttributes: string[]; // "less random", "more strategic"
  };
}
```
Then use these in scoring to apply multipliers: mustHave gets 2x weight, niceToHave gets 1x, avoid gets -1.5x.
**Expected impact:** 15-25% improvement for comparative/nuanced queries.
**Files:** `src/lib/llm/parse-preferences.ts`, `src/lib/llm/types.ts`, `src/lib/recommendation/scoring.ts`

### Tier 3: Medium Impact, Strategic Investment

#### 3.1 Implement BPR for Collaborative Filtering
**What:** Replace frequency-based co-occurrence counting with Bayesian Personalized Ranking (BPR).
**Why:** Fixes Failure Mode 7. BPR is THE algorithm for implicit feedback (thumbs up/down). It learns latent factors that capture taste patterns frequency counting misses.
**How:**
- BPR can be implemented in TypeScript (it's SGD on triplets: user, positive item, negative item)
- Training data: user_game_feedback (rating=1 is positive, rating=-1 is negative)
- Latent dimension: 32-64 factors
- Retrain nightly in a batch job
- At inference: score = dot(user_factors, item_factors)
**Expected impact:** 20-40% improvement in CF quality when sufficient feedback exists.
**Alternative:** Use the `implicit` Python library via a microservice if TypeScript implementation is too complex.
**Files:** `src/lib/recommendation/collaborative.ts`, new training script

#### 3.2 A/B Testing Framework
**What:** Implement randomized experiment assignment for recommendation variants.
**Why:** Koch's core thesis: you can't improve what you don't measure. Without A/B testing, every weight change and algorithm swap is guesswork.
**How:**
1. Assign users to experiment groups (cookie/user-id hash)
2. Log: experiment_group, query, results, user_feedback
3. Compare: CTR, feedback rate, return rate by group
4. Use Koch's split: 5% baseline (most popular), 50% production, 45% experimental
**Expected impact:** Enables evidence-based iteration on all other improvements.
**Files:** New middleware, logging infrastructure, analytics

#### 3.3 Tighten Genre Matching with Semantic Similarity
**What:** Replace the 70 static genre expansion aliases with semantic similarity between user genre terms and game tags.
**Why:** Fixes Failure Mode 3. Static aliases can't capture the full meaning space. "Roguelike" to a user means permadeath + procedural generation + progression loss, not just "adventure + variable player powers."
**How:**
1. Pre-compute embeddings for all unique game tags (~500 tags)
2. At query time, embed the user's genre terms
3. Match by cosine similarity > 0.7 instead of substring matching
4. This naturally handles synonyms, related concepts, and user vocabulary
**Expected impact:** 10-20% improvement in genre matching precision.
**Files:** `src/lib/recommendation/scoring.ts`, new tag embedding cache

### Tier 4: Future Considerations (When Scale Justifies)

#### 4.1 Graph Neural Network for CF (LightGCN)
When user base grows beyond ~10k active users with feedback, consider LightGCN. It propagates collaborative signals through the user-item interaction graph, capturing higher-order relationships (friends of friends' taste). Current frequency-based CF can't do this.

#### 4.2 Contextual Bandits for Exploration
Replace MMR diversity with a proper exploration/exploitation framework (Thompson Sampling or Upper Confidence Bound). This would dynamically balance showing relevant results vs. discovering new user preferences.

#### 4.3 Learned Ranking Model (Learning-to-Rank)
Train a small model (gradient boosted trees or shallow neural net) to predict user satisfaction from the feature vector (all 10 scoring dimensions + CF signals + embedding similarity). This replaces hand-tuned weights with learned weights. Requires ~1000+ feedback samples.

#### 4.4 Pre-packaged RS Libraries
The RSAlgorithms repo (hongleizhang) is outdated (2018, raw numpy). Better alternatives if we need Python:
- **LightFM**: Hybrid CF+content with BPR, handles cold start natively
- **Implicit library**: Optimized ALS/BPR for implicit feedback
- **Surprise**: SVD++/NMF for explicit ratings
- **Microsoft Recommenders**: Production-grade, includes all major algorithms

**Recommendation:** Stay TypeScript for now. Our scale (81k games, <10k users) doesn't justify a Python sidecar. Port BPR to TypeScript (Tier 3.1) instead.

---

## Part 5: What The Research Says We're Doing RIGHT

Not everything needs to change. Our architecture is well-aligned with best practices in several areas:

1. **Hybrid multi-layer approach** -- validated by all sources as the correct pattern
2. **Questionnaire-first for cold start** -- the game-specific research explicitly validates this
3. **LLM for parsing, not for ranking** -- matches the 2024-2025 industry consensus
4. **Diversity enforcement via MMR** -- standard technique, lambda=0.2 is reasonable
5. **Progressive fallback chain** -- guarantees non-empty results, good UX
6. **Rejection learning** -- novel and effective for "Not This" feedback
7. **Multiple candidate sources in parallel** -- maximizes recall
8. **Hard constraint filtering before scoring** -- computationally efficient, correct order
9. **Human-readable reasons** -- important for trust and transparency
10. **Bayesian rating adjustment** -- handles low-vote games correctly

---

## Part 6: Prioritized Implementation Roadmap

### Phase 1: Quick Wins (1-2 days each)
1. **Complete semantic embedding coverage** (1.1) -- batch job, ~$0.40 cost
2. **Rebalance weights** (1.3) -- single constant change, eval suite validates
3. **"Similar To" attribute bootstrapping** (1.2) -- moderate code change in route.ts

### Phase 2: Core Quality (3-5 days each)
4. **Query-adaptive weights** (2.1) -- rules engine in scoring.ts
5. **Intent structure preservation** (2.3) -- enhanced LLM parsing
6. **LLM game metadata enrichment** (2.2) -- batch job, ~$5-10 cost

### Phase 3: Infrastructure (1-2 weeks)
7. **BPR collaborative filtering** (3.1) -- algorithm implementation
8. **Semantic genre matching** (3.3) -- tag embeddings + similarity
9. **A/B testing framework** (3.2) -- experiment infrastructure

### Phase 4: Scale (when justified)
10. LightGCN, contextual bandits, learned ranking

---

## Part 7: Verification Plan

After implementing each change:

1. **Eval suite regression test:** Run `scripts/run-evals.ts` against the 743-case suite. Current baseline: 15%. Target after Phase 1: 35%. Target after Phase 2: 55%. Target after Phase 3: 70%.

2. **Specific failure case testing:**
   - "deck building game" -> Dominion should be top 3
   - "like Catan but less random" -> should recommend Catan-like games without heavy dice mechanics
   - "quick party game for 8 people" -> should recommend actual party games for 8+
   - "solo brain teaser" -> should recommend solo puzzle games
   - "roguelike deck builder" -> Slay the Spire (video), similar board games should dominate

3. **Live quality testing:**
   - Manual spot-check: 20 diverse queries, evaluate top 5 results each
   - User feedback tracking: thumbs up/down rate before vs. after changes

4. **Performance regression:**
   - Recommendation latency should stay under 2s p95
   - No increase in LLM API costs beyond expected batch enrichment

---

## Appendix A: Key Papers for Further Reading

From RSPapers, most relevant to our use case:

1. **Rendle et al. "BPR: Bayesian Personalized Ranking from Implicit Feedback" (UAI 2009)** -- THE algorithm we should implement for our thumbs up/down data
2. **Kula "Metadata Embeddings for User and Item Cold-start Recommendations" (RecSys 2015)** -- validates our embedding approach for cold start
3. **Li et al. "From Zero-Shot Learning to Cold-Start Recommendation" (AAAI 2019)** -- transfer learning for cold start
4. **Gao et al. "Chat-REC: Towards Interactive and Explainable LLMs-Augmented Recommender System" (2023)** -- closest architecture to ours
5. **Hou et al. "Large Language Models are Zero-Shot Rankers for Recommender Systems" (2023)** -- validates our LLM reranking approach
6. **Christakopoulou et al. "Towards Question-based Recommender Systems" (SIGIR 2020)** -- directly validates our questionnaire approach
7. **He et al. "LightGCN: Simplifying and Powering Graph Convolution Network" (SIGIR 2020)** -- future CF upgrade path

## Appendix B: RSAlgorithms Assessment

The hongleizhang/RSAlgorithms repository implements 14 algorithms in Python: UserCF, ItemCF, FunkSVD, PMF, BiasSVD, SVD++, NMF, and 7 social recommendation methods. However:

- **Last updated 2018**, numpy 1.14 dependency
- **No BPR implementation** (the algorithm we most need)
- **No API layer** -- raw Python scripts, not a service
- **No implicit feedback handling**

**Verdict:** Not worth integrating. Better alternatives exist (LightFM, `implicit` library), and at our scale, porting BPR to TypeScript is preferable to adding a Python microservice.

## Appendix C: Navigation Bias Warning

Koch specifically warns about a feedback loop trap: if you learn from biased interaction data and feed recommendations back into the UI, you amplify the bias. Our `feedback-loop.ts` updates preference vectors based on user ratings of *recommended* games -- this creates exactly the loop Koch describes.

**Mitigation:** Our MMR diversity reranking (lambda=0.2) partially addresses this by injecting novelty. But we should also consider:
- Periodically resetting a small portion of the preference vector (exploration)
- Logging and monitoring for "preference vector collapse" (all users converging to similar vectors)
- Injecting random exploration candidates (epsilon-greedy: 5-10% random games in results)
