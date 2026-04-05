# Recommendation System Evaluation Methodology: Deep Research Report

**Date**: 2026-04-04
**Purpose**: Actionable research synthesis for building a world-class game recommendation evaluation framework

---

## Table of Contents

1. [The Fundamental Problem: Offline vs Online Correlation](#1-the-fundamental-problem-offline-vs-online-correlation)
2. [Core Accuracy Metrics (What We Already Have)](#2-core-accuracy-metrics)
3. [Beyond-Accuracy Metrics: Diversity, Novelty, Serendipity](#3-beyond-accuracy-metrics)
4. [LLM-as-Judge Evaluation](#4-llm-as-judge-evaluation)
5. [Human Psychology of Recommendations](#5-human-psychology-of-recommendations)
6. [Industry Approaches: Netflix, Spotify, YouTube](#6-industry-approaches)
7. [Recommendation Failure Taxonomy](#7-recommendation-failure-taxonomy)
8. [Cold Start Evaluation](#8-cold-start-evaluation)
9. [CTR vs Satisfaction: The Engagement Trap](#9-ctr-vs-satisfaction)
10. [Constraint Satisfaction Evaluation](#10-constraint-satisfaction-evaluation)
11. [Counterfactual Evaluation and Bias Correction](#11-counterfactual-evaluation)
12. [Concrete Implementation Plan for boredgame.lol](#12-implementation-plan)

---

## 1. The Fundamental Problem: Offline vs Online Correlation

### The Uncomfortable Truth

Multiple studies show that **offline evaluation results do not reliably predict online performance**. A comparison study found:

- CTR metrics correlate with user ratings at r=0.78 (decent)
- Other offline metrics correlate with user ratings between r=0.52 and r=0.67 (mediocre)
- Offline experiments sometimes **overestimate** precision; other times **underestimate** it
- Results from offline evaluations sometimes **directly contradict** online A/B tests

### Why This Happens

Three fundamental biases plague offline evaluation:

1. **Data Delivery Bias**: Historical data reflects what the *previous* system showed, not what users actually want. If the old system favored popular games, the offline eval rewards algorithms that also favor popular games.

2. **Observational Bias**: We evaluate on historical data, but user behavior changes when the algorithm changes. Offline metrics evaluate fitted historical data, not interventional outcomes.

3. **Cold-Start Bias**: New items have fewer interactions in historical data, so they get systematically underweighted in test sets.

### What This Means For Us

**Offline metrics are a compass, not a map.** They tell you direction (is this change likely better or worse?) but not magnitude. A 1% NDCG improvement offline might translate to 5% engagement improvement online, or 0%.

**Actionable principle**: Use offline metrics for relative comparison between system versions. Never interpret absolute numbers literally. Always pair with at least one human evaluation method.

### Sources
- [Shaped.ai: Offline vs Online Evaluation](https://www.shaped.ai/blog/evaluating-recommender-models-offline-vs-online-evaluation)
- [Castells 2022: Offline Evaluation Challenges](https://onlinelibrary.wiley.com/doi/full/10.1002/aaai.12051)
- [Offline A/B Testing for Recommender Systems (WSDM 2018)](https://arxiv.org/abs/1801.07030)
- [Docear Comparison Study](https://docear.org/papers/A%20Comparison%20of%20Offline%20Evaluations,%20Online%20Evaluations,%20and%20User%20Studies%20...%20(preprint).pdf)

---

## 2. Core Accuracy Metrics

These are the standard IR metrics. Our existing `eval-metrics.ts` already implements all of these correctly.

### Metrics We Have (with benchmark numbers)

| Metric | What It Measures | Industry Benchmarks |
|--------|-----------------|-------------------|
| **NDCG@K** | Ranking quality with graded relevance | MovieLens 100k + LightGCN: 0.42. Most systems: 0.3-0.5. Perfect: 1.0 |
| **MAP@K** | Avg precision across all relevant items | MovieLens 100k: 0.12 (LightGCN). Range: 0.05-0.30 typical |
| **MRR** | How quickly first relevant item appears | Good: >0.5 means first relevant usually in top 2 |
| **Hit Rate@K** | Did we find *anything* relevant? | Should be >0.8 for K=10 in a good system |
| **Precision@K** | Fraction of results that are relevant | 80% precision@10 = 8/10 results relevant |
| **Recall@K** | Fraction of relevant items we found | Heavily depends on catalog size; 0.10-0.30 typical |

### Algorithm Performance Reference (MovieLens 1M, K=10)

| Algorithm | NDCG@10 | Precision@10 | Recall@10 | Training Time |
|-----------|---------|-------------|----------|---------------|
| ALS | 0.028 | 0.036 | 0.011 | 11s |
| SAR | 0.312 | 0.280 | 0.111 | 2s |
| LightGCN | 0.424 | 0.386 | 0.147 | 33min |
| BiVAE | 0.425 | 0.389 | 0.147 | 9min |

### Key Insight

Our baseline of ~15% is actually in a reasonable range for a production recommendation system. The important thing is **relative improvement**, not absolute numbers.

### Sources
- [Evidently AI: 10 Metrics to Evaluate Recommender Systems](https://www.evidentlyai.com/ranking-metrics/evaluating-recommender-systems)
- [Aman's AI Journal: RecSys Metrics](https://aman.ai/recsys/metrics/)
- [Comprehensive Survey of Evaluation Techniques (2023)](https://arxiv.org/html/2312.16015v2)

---

## 3. Beyond-Accuracy Metrics: Diversity, Novelty, Serendipity

### Why Beyond-Accuracy Metrics Matter More Than Accuracy

A landmark study of 445 MovieLens users found a devastating disconnect:

**Deep learning models that scored highest on novelty and serendipity had LOWER user satisfaction than simple collaborative filtering baselines.** The causal chain was:

> Low diversity + high serendipity --> reduced transparency --> undermined trust --> lower satisfaction

The path model explained **55.1% of satisfaction variance** (R^2 = 0.551). The specific scores:

| Dimension | DL Models | CF Baselines |
|-----------|-----------|-------------|
| Diversity | 3.43-3.97 | 3.96-4.00 |
| Transparency | 2.40-3.20 | 3.25-3.59 |
| Trustworthiness | 2.88-3.47 | 3.23-3.50 |
| Accuracy perception | 2.81-3.21 | 3.01-3.28 |
| Overall satisfaction | 3.12-3.46 | 3.16-3.50 |

**Critical finding**: Users want **accuracy PLUS one other attribute**. 54 of 76 users specifically wanted accuracy + novelty. They want to discover things they did not know about but will actually like.

### Diversity: Intra-List Diversity (ILD)

**What it is**: Average pairwise distance between items in a recommendation list.

**Formula** (already implemented in our eval):
```
ILD@K = (2 / (K * (K-1))) * sum_all_pairs distance(item_i, item_j)
```

**Distance functions**:
- Jaccard distance on tag sets: `1 - |A intersect B| / |A union B|` (what we use)
- Cosine distance on embeddings: `1 - cos_sim(emb_i, emb_j)` (richer but needs vectors)
- Category-based: count distinct genres/mechanics in result set

**Why it matters for games**: A list of 10 worker placement games all with similar themes is useless even if each individually is a great match. Users want variety in their recommendation set.

**Spotify's data**: Users with diverse listening are **10-20 percentage points less likely to churn**. Personalized recommendations decreased individual-level diversity by 11.51% but increased aggregate diversity by 5.96%.

**Target**: ILD > 0.6 on tag-based distance. Below 0.4 indicates dangerously homogeneous results.

### Novelty

**What it is**: How obscure/long-tail the recommended items are.

**Formulas**:
```
Logarithmic: Novelty(i) = -log2(count(users who interacted with i) / count(all users))
Linear:      Novelty(i) = 1 - count(users who interacted with i) / count(all users)
```

We use the logarithmic version based on ratingCount, which is correct.

**Benchmark data**: On MovieLens 100k, novelty ranged from 11.58 (small dataset) to 20.09 (MovieLens 10M, larger catalog). Catalog coverage dropped from 39.5% to 15.7% as dataset grew.

**Why it matters**: Recommending only popular games is trivial. Any system can suggest Catan and Ticket to Ride. The value is in surfacing lesser-known games the user will love.

**Target**: Novelty > 8.0 (on log2 scale with our normalization). A CTR system with 38% improvement from personalization vs popularity-based suggests there IS value in personalized long-tail recommendations.

### Serendipity

**What it is**: Recommendations that are both relevant AND unexpected.

**Formula**:
```
Serendipity(i) = Unexpectedness(i) * relevance(i)
```

Where:
- `relevance = 1` if user interacted positively, 0 otherwise
- `Unexpectedness` can be measured via:
  - PMI (Pointwise Mutual Information) against user history
  - Cosine distance from user's typical preference profile
  - Whether item would appear in a "primitive" baseline (e.g., most-popular)

**The practical problem**: There is NO industry-agreed standard for measuring serendipity. And in offline evaluation, deliberately introducing long-tail items makes relevance metrics look worse, even when A/B tests show improved conversion.

**How to implement for our eval**:
1. For each recommended game, compute cosine distance from the user's stated preference embedding
2. Multiply by relevance grade (from our existing graded results)
3. Average across the recommendation list
4. A serendipitous result is one that's far from the user's stated preferences but still highly rated

**Target**: Serendipity > 0.15 (on a 0-1 scale). This is inherently hard to measure offline.

### Catalog Coverage

**What it is**: What percentage of the total catalog can the system recommend?

**Formula**:
```
Coverage = |unique items recommended across all users| / |total catalog|
```

**Benchmarks**: 15-40% is typical. Below 10% suggests severe popularity bias.

**Distributional Coverage** (entropy-based, more sophisticated):
```
DC = -sum(p(i) * log2(p(i))) for all items i
```
Where p(i) = fraction of times item i is recommended. Higher entropy = more uniform distribution.

### Sources
- [Human-Centric Evaluation of Movie Recommenders (2024)](https://arxiv.org/html/2401.11632)
- [Eugene Yan: Serendipity and Accuracy](https://eugeneyan.com/writing/serendipity-and-accuracy-in-recommender-systems/)
- [Spotify Engagement-Diversity Connection](https://research.atspotify.com/publications/the-engagement-diversity-connection-evidence-from-a-field-experiment-on-spotify)
- [Shaped.ai: Serendipity Metrics](https://www.shaped.ai/blog/not-your-average-recsys-metrics-part-1-serendipity)
- [ACM Survey: Diversity, Serendipity, Novelty, and Coverage](https://dl.acm.org/doi/10.1145/2926720)

---

## 4. LLM-as-Judge Evaluation

### Why This Is Critical For Us

Our recommendation system uses LLM components (preference parsing, re-ranking). Traditional IR metrics cannot evaluate whether the LLM correctly understood "I want something like Pandemic but shorter" because that requires semantic judgment. LLM-as-judge fills this gap.

### Agreement Rates With Humans

- **GPT-4 as evaluator**: >80% agreement with human preferences in pairwise comparison tasks
- **Domain-specific tasks**: Agreement drops to 60-68% in expert domains
- For game recommendations (moderate domain expertise needed), expect ~70-75% agreement

### Three Evaluation Patterns

#### 1. Pointwise Scoring (Best for our eval suite)
Give the LLM the user query, constraints, and each recommended game. Ask it to score on specific dimensions.

**Implementation**: Score each recommendation 1-5 on:
- Query relevance: "Does this game match what the user asked for?"
- Constraint satisfaction: "Does this game meet stated constraints (player count, time, complexity)?"
- Preference alignment: "Based on stated preferences, would this user enjoy this?"

#### 2. Pairwise Comparison (Best for A/B testing system versions)
Show two recommendation lists and ask which is better.

**Implementation**: Compare system v1 vs v2 outputs for same query. Randomize order to mitigate position bias.

#### 3. Reference-Based Evaluation (Best for ground truth validation)
Compare recommendations against a "gold standard" list.

### Best Practices (From Research)

1. **Use binary or 3-point scales, not 5-point**. Three options (relevant / partially relevant / not relevant) are more reliable than fine-grained scales.

2. **Split criteria into separate evaluators**. Do NOT ask "rate this recommendation on relevance, diversity, novelty, and constraint satisfaction" in one prompt. Run four separate evaluations and combine deterministically.

3. **Include few-shot examples**. 2-3 labeled examples dramatically improve reliability.

4. **Require chain-of-thought reasoning**. Ask the LLM to explain BEFORE giving a score. This improves quality and creates an audit trail.

5. **Set temperature to 0** for reproducibility.

6. **Mitigate position bias**: Randomize order of items in pairwise comparisons. Accuracy can shift >10% just from swapping presentation order.

7. **Mitigate verbosity bias**: LLM judges prefer longer, more formal outputs. Control for this by evaluating content substance separately from presentation.

### Practical Prompt Template for Game Recommendations

```
You are evaluating a game recommendation system. 

USER QUERY: "{query}"
USER CONSTRAINTS: {constraints}

RECOMMENDED GAME: {game_name}
  - Player count: {min_players}-{max_players}
  - Play time: {play_time} minutes
  - Complexity: {complexity_weight}/5
  - Genres: {genres}
  - Description: {description}

Rate this recommendation on a scale of 0-2:
  0 = NOT RELEVANT - This game does not match the user's request
  1 = PARTIALLY RELEVANT - Some aspects match but significant misalignment exists  
  2 = HIGHLY RELEVANT - This game clearly matches the user's request

First, explain your reasoning step by step. Then provide your score.

REASONING:
SCORE:
```

### Quality Assurance for LLM Judges

Follow this 5-step development cycle:
1. Define evaluation scope (what property to assess)
2. Prepare 50-200 diverse evaluation examples
3. Create manual labels yourself (your ground truth)
4. Craft evaluation prompt aligned with your labels
5. Validate LLM judge against your labels using precision/recall

### Sources
- [Evidently AI: LLM-as-a-Judge Complete Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Monte Carlo Data: 7 Best Practices](https://www.montecarlodata.com/blog-llm-as-judge/)
- [LLM-as-a-Judge Survey (2024)](https://arxiv.org/abs/2411.15594)
- [RecSys 2025 Workshop: LLM-as-Judge for Recommendations](https://earl-workshop.github.io/pdf/recsys2025-workshops_paper_4.pdf)

---

## 5. Human Psychology of Recommendations

### What Makes Users FEEL Like Recommendations Are Good

This is arguably the most important section. All the metrics above are proxies for the real question: does the user trust and enjoy the recommendations?

#### 1. Transparency and Explanations

- **74% of users** want to know WHY something was recommended
- Providing explanations **increases perceived recommendation quality by 34%**
- Effective explanation example: "We recommended Arrival because you liked Inception and Interstellar -- movies that made you think"
- Explainability improves precision by 3% AND increases user satisfaction and trust

**For our system**: The "human-readable reasons" in our scoring system are not just nice-to-have. They are critical trust infrastructure. Every recommendation should have a clear, user-facing reason.

#### 2. The Accuracy + X Formula

Users don't want just accuracy. They want **accuracy PLUS one other attribute**:
- 54 users: accuracy + novelty ("Find me things I don't know about that I'll like")
- 12 users: accuracy + diversity ("Show me different types of things")
- 10 users: accuracy + serendipity ("Surprise me with something unexpected")

**The killer combination is: accurate AND novel.** Users want to feel like the system knows them well enough to find hidden gems.

#### 3. Trust Calibration

Trust is built through:
- **Consistency**: The system behaves predictably. Same input, similar output.
- **Reliability**: Recommendations are generally good over time.
- **Agency**: Users can override, give feedback, and feel in control.
- **Humility**: The system acknowledges uncertainty rather than projecting false confidence.

Trust is destroyed by:
- Uncertainty and inconsistency
- Opaque "black box" recommendations with no explanation
- Recommendations that obviously violate stated preferences (e.g., recommending 6-player games when user said "2 players")
- Lack of user control

#### 4. The Mere Exposure Effect and Familiarity

Users develop preference for things they are familiar with (mere exposure effect). This creates a tension:
- Including 1-2 recognizable "anchor" games in a list builds trust ("the system knows me")
- But too many familiar items feel lazy ("I already know about Catan")

**Optimal mix**: ~20-30% recognizable items, ~70-80% discovery items. The familiar items validate the system's understanding; the novel items deliver the value.

#### 5. Choice Overload and the Paradox of Choice

- Conversion rates peak at **4-6 options** per decision point
- Beyond that, decision quality declines sharply
- With 6 options, users are significantly more likely to purchase than with 24
- Meta-analysis of ~100 studies: excessive options reduce satisfaction, increase regret, decrease likelihood of choosing at all

**For our system**: Showing 10 recommendations is fine as a ranked list, but the UI should emphasize the top 3-5 as primary suggestions. Overwhelming users with 20+ recommendations will decrease satisfaction.

#### 6. Emotional Valence

- Happiness and gratitude increase trust in recommendations
- Anger decreases trust
- The emotional state during interaction affects perception of quality

**For our system**: The playful, memey tone of boredgame.lol is actually an asset here. Making users smile before they see results primes positive emotional valence.

### Sources
- [Trust and Transparency in Recommender Systems (2023)](https://arxiv.org/pdf/2304.08094)
- [Transparency and Precision in AI Recommendations](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2024.1410790/full)
- [The Decision Lab: Paradox of Choice](https://thedecisionlab.com/reference-guide/economics/the-paradox-of-choice)
- [The Decision Lab: Choice Overload](https://thedecisionlab.com/biases/choice-overload-bias)
- [Mere Exposure Effect - Wikipedia](https://en.wikipedia.org/wiki/Mere-exposure_effect)

---

## 6. Industry Approaches: Netflix, Spotify, YouTube

### Netflix

#### Two-Stage Testing Pipeline
1. **Stage 1: Interleaving** (fast pruning)
   - Single user group sees blended rankings from algorithms A and B
   - Measures preference by tracking which algorithm's recommendations get more watch hours
   - **100x more sample-efficient than A/B testing**: needs 10^3 samples vs 10^5 for A/B
   - Used to quickly prune from 5-10 algorithm variants to top 2-3

2. **Stage 2: Traditional A/B testing** (validation)
   - Pared-down set of algorithms tested on separate user groups
   - Measures longer-term metrics: month-to-month retention, streaming hours
   - Typically runs 5-10 variants simultaneously

#### Key Metrics
- Subscription retention (month-over-month)
- Member streaming hours
- "Take fraction" (items recommended that users actually engage with)

#### Offline Evaluation: Replay Method
Compares algorithms on the same historical user sessions. The offline take fraction can accurately predict which algorithm will win online.

### Spotify

#### The Diversity-Retention Connection
Hard data from Spotify research:
- Users with diverse listening are **10-20 percentage points less likely to churn**
- Diverse listening associated with higher conversion AND retention
- Personalized recommendations decreased individual diversity by 11.51%
- But increased aggregate diversity by 5.96% (exposed users to more of the catalog overall)

#### Explore-Exploit Architecture
- **Exploration phase**: Estimate potential audience of new content using multi-armed bandits
- **Exploitation phase**: Relay learned information to personalization components
- Treatment: Each song suggestion is a "treatment" and user response teaches the system

#### Key Learning
Spotify found that **optimizing purely for engagement reduces diversity**, which **hurts long-term retention**. They now explicitly balance short-term engagement with diversity targets.

### YouTube

#### Evolution of Metrics
1. **Pre-2012**: Click-through rate and view count (led to clickbait optimization)
2. **2012-2020**: Watch time as primary signal (better but still gameable)
3. **2020-2025**: "Valued watch time" incorporating satisfaction signals
4. **2025+**: "Satisfaction-weighted discovery" model overhaul

#### Current Approach
- Direct user satisfaction surveys (ask viewers how they felt about recommendations)
- Sentiment modeling from comments and likes/dislikes ratios
- Long-session retention tracking
- Rewatch rates as satisfaction signals
- Explicit diversity and novelty components to prevent repetitive recommendations

#### Key Insight
YouTube learned the hard way that **CTR and watch time incentivize clickbait**. Their shift to direct satisfaction surveys was a major paradigm change. Survey responses influence both how videos perform and how similar content appears.

### Sources
- [Netflix Tech Blog: Interleaving in Online Experiments](https://netflixtechblog.com/interleaving-in-online-experiments-at-netflix-a04ee392ec55)
- [Netflix Recommender System Paper](https://dl.acm.org/doi/pdf/10.1145/2843948)
- [Spotify: Algorithmic Effects on Diversity](https://research.atspotify.com/2020/12/algorithmic-effects-on-the-diversity-of-consumption-on-spotify)
- [Spotify: Engagement-Diversity Connection](https://research.atspotify.com/publications/the-engagement-diversity-connection-evidence-from-a-field-experiment-on-spotify)
- [YouTube Recommendation System](https://www.shaped.ai/blog/how-youtubes-algorithm-works)

---

## 7. Recommendation Failure Taxonomy

### Systematic Failure Modes

Based on research synthesis across multiple papers and our own BGG user feedback:

#### 1. Hard Constraint Violations (Most Damaging to Trust)
- Recommending games outside stated player count range
- Recommending games that exceed time constraints
- Recommending games above/below complexity tolerance
- **Impact**: Immediate, severe trust destruction. Users feel the system "isn't listening."

#### 2. Preference Misunderstanding
- LLM parses user intent incorrectly
- Mechanic/genre confusion (e.g., "deck-building" interpreted as "card game")
- Ignoring free-text nuance (e.g., "something cozy" being treated generically)
- **Impact**: High. Users feel unheard.

#### 3. Popularity Bias / Echo Chamber
- System over-recommends popular games everyone already knows
- Reinforces "rich get richer" dynamics in the catalog
- Ignores long-tail games that might be perfect matches
- **Impact**: Medium. Recommendations are safe but valueless.

#### 4. Filter Bubble / Homogeneity
- All recommendations cluster around same genre/mechanic
- System exploits one preference dimension and ignores others
- Result list feels like 10 variations of the same game
- **Impact**: Medium. Users feel the system is one-dimensional.

#### 5. Cold Start Failures
- New users with no history get generic/popular recommendations
- New games in catalog never get recommended because they lack interaction data
- **Impact**: Medium for new users; systemic for catalog health.

#### 6. Temporal Irrelevance
- Recommending games user has already played/owns
- Not adapting to changing preferences over time
- **Impact**: Low-medium, but feels lazy.

#### 7. Explanation Failures
- No reason given for recommendation
- Reason doesn't match user's stated preferences
- Reason is generic ("Based on your interests")
- **Impact**: Erodes trust incrementally.

### Methodological Failures (From "We're Still Doing It Wrong" - 2025 Paper)

The academic community itself has persistent evaluation problems:

1. **Narrow metric fixation**: 32% of papers use a single metric; 70%+ use three or fewer
2. **Confusing behavior with preference**: Clicks are not preference. They're shaped by what the system showed.
3. **Reproducibility illusion**: Simple algorithms yield inconsistent results across frameworks due to differing defaults
4. **Optimization over understanding**: Chasing 0.1% NDCG improvements without understanding if they matter to users

### Sources
- [We're Still Doing It Wrong: Recommender Systems Fifteen Years Later (2025)](https://arxiv.org/html/2509.09414v1)
- [Filter Bubbles in Recommender Systems: Systematic Review](https://arxiv.org/html/2307.01221)
- [Comprehensive Review of Recommendation System Challenges](https://link.springer.com/article/10.1186/s40537-022-00592-5)

---

## 8. Cold Start Evaluation

### The Two Cold Start Problems

**New User Cold Start**: User has no interaction history. System must recommend based solely on:
- Stated preferences from questionnaire
- Demographic information
- Content-based signals (what they describe wanting)

**New Item Cold Start**: Game was just added to catalog. No users have interacted with it. Must rely on:
- Item metadata (genres, mechanics, player count, complexity)
- Embedding similarity to existing items
- Curated/editorial placement

### Evaluation Methodology

1. **Baseline: Most Popular (MP) algorithm**
   - Present new users with globally popular items
   - This is the simplest possible strategy
   - Any good cold-start approach must beat this

2. **Stratified evaluation by user history**
   - Split users into buckets by interaction count: 0, 1-5, 5-20, 20+
   - Evaluate metrics separately for each bucket
   - The drop-off from warm users to cold users reveals cold-start severity

3. **Leave-one-out for new items**
   - Remove one item from training data entirely
   - Can the system still recommend it based on metadata alone?
   - Measure recall of held-out items

### For Our System

Our questionnaire-based approach is actually well-suited for cold start because we collect rich preference signals upfront (genres, mechanics, player count, complexity, play time, free text). We should evaluate:

- How well does the system perform for a user who ONLY has questionnaire data (no feedback history)?
- Metric: Compare NDCG for questionnaire-only vs questionnaire + 5 feedback signals

### Sources
- [Cold Start Problem in Recommender Systems (Wikipedia)](https://en.wikipedia.org/wiki/Cold_start_(recommender_systems))
- [User Cold Start: Systematic Review](https://www.researchgate.net/publication/376140792_User_Cold_Start_Problem_in_Recommendation_Systems_A_Systematic_Review)
- [Solving Cold Start (Things Solver)](https://thingsolver.com/blog/the-cold-start-problem/)

---

## 9. CTR vs Satisfaction: The Engagement Trap

### The Core Problem

Early recommendation systems (including YouTube pre-2012) optimized for clicks. This led to:
- Clickbait optimization
- Shallow engagement (click but quickly abandon)
- Short-term spikes with long-term user disillusionment

**Key finding**: CTR measurements can be misleading and do not actually capture business value well. Not all engagement is equal.

### The Shift to Satisfaction

Modern systems measure:

| Old Metric | New Metric | Why Better |
|-----------|-----------|-----------|
| Click-through rate | Valued engagement time | Filters out clickbait |
| View count | Rewatch rate | Indicates genuine satisfaction |
| Session count | Long-session retention | Measures sustained value |
| Implicit signals only | Direct satisfaction surveys | Measures what users actually think |

### The Returning User Framework

Traditional bandit algorithms assume users always return. In reality, **bad recommendations cause users to leave**. The total number of future interactions depends on recommendation quality. Modern approaches balance:
- Immediate engagement (will they click?)
- Return probability (will they come back?)
- Expected future interactions (total lifetime value)

### Survey-Based Satisfaction

YouTube pioneered this: directly survey users about recommendation satisfaction. Survey responses are:
- More predictive of retention than engagement metrics
- Able to capture satisfaction nuances engagement can't (e.g., "I watched it but wish I hadn't")
- Valuable for training satisfaction prediction models

### For Our System

We don't have CTR, but we do have feedback signals (thumbs up/down, "More Like This", "Not This"). These are closer to satisfaction signals than engagement metrics. Our eval should weight:
- Positive feedback rate on recommendations (satisfaction proxy)
- Return usage rate (do users come back for more recommendations?)
- Constraint violation rate (most direct measure of system failure)

### Sources
- [Shaped.ai: How YouTube's Algorithm Works](https://www.shaped.ai/blog/how-youtubes-algorithm-works)
- [Retentive Relevance: Long-Term User Value (2025)](https://arxiv.org/pdf/2510.07621)
- [Measuring Business Value of Recommender Systems](https://arxiv.org/pdf/1908.08328)

---

## 10. Constraint Satisfaction Evaluation

### Why This Is Our Most Important Metric

From our BGG user feedback research, the #1 complaint was **constraint violations**: recommending games with wrong player count, too long play time, or wrong complexity. This is the single fastest way to destroy user trust.

### Evaluation Framework

#### Hard Constraints (Must Be 100% Satisfied)
- Player count: recommended game MUST support the stated player count
- Game type: if user asked for board games, don't recommend video games

#### Soft Constraints (Should Be Mostly Satisfied)
- Play time: should be within reasonable range of stated preference
- Complexity: should be within 1 point of stated preference
- Genre: should align with at least one stated genre preference

### Metric: Constraint Violation Rate

```
CVR = count(recommendations violating ANY hard constraint) / count(total recommendations)
```

**Target**: CVR = 0% for hard constraints. CVR < 10% for soft constraints.

### Implementation

For each eval case, define explicit constraints and check each recommendation:
```json
{
  "query": "Worker placement game for 2 players under 60 minutes",
  "constraints": {
    "playerCount": 2,
    "maxPlayTime": 60,
    "mechanics": ["Worker Placement"]
  }
}
```

Then verify each recommended game's metadata against these constraints.

### Sources
- [Constraint-Based Recommender Systems (ACM)](https://dl.acm.org/doi/pdf/10.1145/1409540.1409544)
- [Evaluating Recommender Systems: Survey and Framework](https://dl.acm.org/doi/10.1145/3556536)

---

## 11. Counterfactual Evaluation and Bias Correction

### The Problem

Our offline evaluation data is biased by what our current system shows. If the current system never recommends obscure games, we have no data on whether users would like them.

### Inverse Propensity Scoring (IPS)

**Core idea**: Reweight historical observations by how likely they were to be shown.

**Formula**:
```
IPS estimate = mean(reward * (P_new(action|context) / P_old(action|context)))
```

Where:
- `reward` = user interaction (click, thumbs up, etc.)
- `P_new` = probability new system recommends this item
- `P_old` = probability old system recommended this item
- The ratio is the "importance weight"

### Self-Normalized IPS (SNIPS)

**Best performer** in studies. Divides by the sum of importance weights to normalize:
```
SNIPS = sum(weight_i * reward_i) / sum(weight_i)
```

**Advantage**: No parameter tuning needed. Least estimation error.
**Disadvantage**: Requires importance weights for ALL observations (not just positive ones), increasing storage 10x+ when CTR < 10%.

### Capped IPS

Set maximum threshold for importance weights (e.g., cap at 10). Prevents extreme variance from rare events.

### Practical Tips

1. **Obtain action probabilities from impression counts** (most direct measure)
2. **Keep new recommenders close to production** to prevent explosive importance weights
3. **Show random samples on a small traffic sliver** to get unbiased data for items the system normally wouldn't show

### Relevance For Us

We likely don't need full counterfactual evaluation yet. But we SHOULD:
- Track what gets recommended (impression logs)
- Occasionally inject random recommendations to gather unbiased feedback
- Be aware that our eval data is biased toward our current system's preferences

### Sources
- [Eugene Yan: Counterfactual Evaluation for Recommendations](https://eugeneyan.com/writing/counterfactual-evaluation/)
- [Counterfactual Risk Minimization with IPS-Weighted BPR (2025)](https://arxiv.org/abs/2509.00333)
- [Recommendations as Treatments: Debiasing Learning and Evaluation](https://arxiv.org/pdf/1602.05352)

---

## 12. Concrete Implementation Plan for boredgame.lol

Based on all research, here is a prioritized plan for enhancing our evaluation framework.

### What We Already Have (Strong Foundation)
- NDCG@K, MAP@K, MRR, Hit Rate, Precision@K, Recall@K
- Intra-List Diversity (ILD) via Jaccard distance on tags
- Novelty via log-popularity
- Constraint Violation Rate
- 60+ eval cases with shouldInclude/shouldNotInclude
- Graded relevance scoring (0-3)

### Priority 1: LLM-as-Judge Evaluation Layer

**Why first**: Highest impact for lowest effort. Our existing eval cases define intent; an LLM judge can evaluate semantic match quality that binary shouldInclude/shouldNotInclude cannot.

**Implementation**:
1. For each eval case, run the recommendation pipeline
2. For each result, ask GPT-4o-mini to score 0-2 on:
   - Query relevance (does this game match the user's request?)
   - Constraint satisfaction (player count, time, complexity)
   - Preference alignment (genres, mechanics, theme)
3. Use separate prompts per dimension (not combined)
4. Include 3 few-shot examples per dimension
5. Temperature = 0 for reproducibility
6. Aggregate as `llm_relevance`, `llm_constraint_score`, `llm_preference_score`

**Validation**: Label 50 examples yourself first. LLM judge should achieve >75% agreement with your labels.

### Priority 2: Serendipity Metric

**Why**: The accuracy + novelty combination is what users most want, and serendipity captures this directly.

**Implementation**:
1. For each recommended game, compute embedding distance from the query embedding
2. Multiply by relevance grade: `serendipity_i = distance_i * (relevance_i / 3)`
3. Average across the list
4. Add to `EvalMetrics` interface as `serendipity: number`

### Priority 3: Explanation Quality Evaluation

**Why**: 74% of users want to know WHY. Our scoring reasons are a competitive advantage.

**Implementation**:
1. For each recommendation, extract the human-readable reason
2. LLM-judge score on:
   - Specificity: Does it reference actual game features, not generic descriptions?
   - Relevance: Does it connect to the user's stated preferences?
   - Helpfulness: Would this help a user decide whether to try the game?

### Priority 4: Familiarity-Discovery Balance

**Why**: The 20-30% familiar / 70-80% discovery mix builds trust and delivers value.

**Implementation**:
1. Define "familiar" as games with ratingCount > P90 (top 10% popularity)
2. For each result list, compute `familiarity_ratio = count(familiar) / K`
3. Target: 0.2-0.3. Below 0.1 = too obscure, may lose trust. Above 0.5 = too obvious, no value.

### Priority 5: Per-Failure-Mode Tracking

**Why**: Aggregate metrics hide specific failure patterns.

**Implementation**:
Track these failure categories separately:
1. Hard constraint violations (player count, game type)
2. Soft constraint violations (time, complexity)
3. Preference misunderstandings (wrong genre/mechanic category)
4. Homogeneity failures (ILD < 0.3)
5. Popularity bias failures (all top-10 results are in top-50 most popular)
6. Cold-start failures (eval cases with unusual/niche queries)

### Priority 6: Comparative Testing Framework

**Why**: The most reliable offline signal is relative comparison between system versions, not absolute metrics.

**Implementation**:
1. Store eval results with system version identifier
2. Run same eval cases against multiple system configs
3. Report delta (improvement/regression) per metric
4. Flag statistical significance using paired t-test or Wilcoxon signed-rank
5. Inspired by Netflix interleaving: for each eval case, which system version's results would the user prefer? (Use LLM pairwise comparison)

### Metric Targets Summary

| Metric | Current Baseline | Target | Notes |
|--------|-----------------|--------|-------|
| NDCG@10 | ~0.15 | >0.25 | Relative improvement matters more than absolute |
| Hit Rate@5 | Unknown | >0.80 | At least one relevant game in top 5 |
| Precision@10 | Unknown | >0.50 | Half the results should be relevant |
| ILD@10 | Unknown | >0.60 | Results should be diverse |
| Novelty@10 | Unknown | >8.0 | Favor long-tail over obvious picks |
| Constraint Violation Rate | Unknown | 0% hard, <10% soft | #1 priority for user trust |
| Familiarity Ratio | Unknown | 0.20-0.30 | Trust anchors + discovery |
| LLM Relevance Score | N/A | >1.5/2.0 | Most results should be relevant |
| Serendipity | N/A | >0.15 | Relevant AND surprising |

### Sources (for open-source eval tooling)
- [GitHub: Evaluation Metrics for Recommendation Systems](https://github.com/aryan-jadon/Evaluation-Metrics-for-Recommendation-Systems)
- [GitHub: recmetrics library](https://github.com/statisticianinstilettos/recmetrics)
- [GitHub: deepeval (LLM evaluation framework)](https://github.com/confident-ai/deepeval)

---

## Key Takeaways

1. **Offline metrics are necessary but insufficient.** They're a compass pointing in the right direction, not a GPS telling you exactly where you are.

2. **The user psychology research is clear**: people want accurate + novel recommendations with transparent explanations. The system that wins is the one that surfaces hidden gems the user would never have found, while explaining exactly why each recommendation fits.

3. **Constraint violations are the #1 trust killer.** Fixing a single player-count violation is worth more than a 5% NDCG improvement.

4. **Diversity is not just nice-to-have.** Spotify proved it: diverse recommendations reduce churn by 10-20 percentage points. Homogeneous results feel lazy.

5. **LLM-as-judge is the best new tool for offline evaluation.** It fills the semantic understanding gap that traditional metrics cannot. But it must be validated against human labels and used with proper bias mitigation.

6. **The choice overload research supports our current design.** Showing ~10 ranked results with emphasis on the top 3-5 is psychologically optimal.

7. **Always compare against yourself.** Absolute metric values are meaningless without context. Track improvement over previous system versions.
