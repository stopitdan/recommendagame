# Engine Improvement Recommendations

Based on eval runs against the current recommendation engine (307 cases, 68.4% pass rate, 7.14/10 LLM judge score).
These are findings from evaluation that should inform future engine work.
Data-backed, verified across multiple runs.

---

## Critical Finding 1: BGG Mechanic Alias Gap in Scoring

**File:** `src/lib/recommendation/scoring.ts`, function `scoreFreeTextLLM`

**Issue:** The LLM parses "Deck Building" as a mechanic. BGG stores it as "Deck, Bag, and Pool Building". The scoring function does substring matching: `gameMechanic.includes(userMechanic)`. But "deck, bag, and pool building" does NOT include "deck building" as a substring.

**Impact:** Every mechanic-focused query scores freeTextMatch=0 for games that actually have the mechanic. Dominion gets freeTextMatch=0 for "deck building game".

**Fix:** Use the BGG_MECHANIC_ALIASES map (already in route.ts for candidate fetching) during scoring too. Created `src/lib/recommendation/mechanic-aliases.ts` with shared `mechanicMatches()` function.

**Evidence:**
- Baseline eval: mechanic-focused category pass rate = 5% (1/20)
- After fix: mechanic-focused pass rate = 15% (3/20)
- Dominion freeTextMatch: 0 -> 1.0

## Critical Finding 2: Roll-and-Write Alias Incorrect

**File:** `src/app/api/recommend/route.ts` and `src/lib/recommendation/mechanic-aliases.ts`

**Issue:** "roll and write" is aliased to `['Roll-and-Write', 'Roll / Spin and Move']`. Roll & Move is a completely different mechanic (Monopoly, Sorry!). This causes Roll & Move games (Trivial Pursuit, Rail Baron) to score as roll-and-write matches.

**Fix:** Remove "Roll / Spin and Move" from the roll-and-write alias.

## Critical Finding 3: Designer Match Scoring Too Weak

**Issue:** When user asks "games by Stefan Feld", a Feld game gets designerMatch = 1.5/totalChecks. A non-Feld game gets 0/totalChecks. After dividing by totalChecks (usually 4), the gap is only ~0.375. With freeText weight at 0.45, that's a 0.17 difference -- not enough to overcome genre/popularity noise.

**Evidence:**
- "Stefan Feld" query: Only 1/10 top results was a Feld game
- After strengthening designer match (2.0 for match, -0.8 for miss): 8/10 were Feld games

**Recommendation:** Increase designer match contribution to +2.0 and penalize non-designer games with -0.8.

## Critical Finding 4: LLM-Parsed Constraints Not Merged

**Issue:** When LLM extracts `complexity: {min: 1, max: 2}` from "worker placement for beginners", this constraint is NEVER applied to hard filtering or scoring weights. The body still uses the default {1, 5} range.

**Evidence:** "worker placement for beginners" returns heavy games (complexity 3.5+)

**Recommendation:** Merge LLM-parsed complexity and playerCount into the request body when the client sent default ranges.

## Finding 5: "Similar-To" Returns the Referenced Game

**Issue:** "something like Catan but better" returns Catan and its variants as top results. The similarTo matching gives a boost to games whose name matches the referenced game.

**Recommendation:** Penalize games that ARE the referenced game or its variants. The user wants alternatives, not the thing they already know about.

## Finding 6: Broad Queries Need Quality Tiebreaker

**Issue:** For "deck building game", all deck builders score similarly on freeText/genre. The only differentiator between Dominion (96k ratings) and Colony (2k ratings) is quality/popularity at 7% combined weight. Not enough.

**Recommendation:** For broad queries (few constraints), boost quality/popularity weight as a tiebreaker among equally-relevant results.

## Finding 7: Engine Returns Relevant-But-Obscure Games

**Overall pattern:** NDCG is 0.97 (very high), meaning results ARE topically relevant. But famous definitive games (Dominion, Codenames, Spirit Island) often rank below obscure ones. The 81k game catalog has many niche games that score well on genre match but aren't what users expect.

**User psychology insight:** When someone asks "deck building game", they usually want the canonical examples first. They can discover niche ones later. The first few results should be the "if you ask anyone who plays board games" answers.

---

## Priority Order for Implementation

1. **BGG Mechanic Alias in Scoring** (Critical -- affects ALL mechanic queries)
2. **Roll-and-Write Alias Fix** (Bug -- wrong games showing up)  
3. **LLM Constraint Merge** (High -- complexity/playerCount from freeText not applied)
4. **Designer Match Strength** (High -- designer queries broken)
5. **Similar-To Penalization** (Medium -- "like X" returns X)
6. **Broad Query Tiebreaker** (Medium -- famous games buried)

---

## Research-Backed Eval Framework Improvements

Based on comprehensive research across Netflix, Spotify, RecSys conferences, and academic literature.

### Metrics to Add (from research)

1. **Catalog Coverage** - What % of the 81k game catalog ever appears in recommendations across all eval cases? Low coverage = popularity bias. Track: `uniqueGamesRecommended / totalCatalogSize`.

2. **Serendipity@K** - Are we recommending things the user wouldn't have found on their own but would love? Measured as: relevant AND dissimilar to the query's obvious matches.

3. **Category Proportionality** - If someone asks for "party games," are results diverse within that category, or all the same sub-type?

4. **Popularity Percentile Tracking** - Average popularity percentile of recommended items. If top-10 always contains 90th+ percentile popularity games, we have popularity bias.

5. **Per-Constraint Violation Breakdown** - Break constraint violations into: player count, time, complexity, game type. BGG user feedback specifically flagged time and player count.

### Eval Methodology Improvements (from research)

1. **LLM Judge should use pairwise comparison** (arxiv 2411.15594) - Asking "Is Game A or Game B better for this query?" produces more reliable judgments than "Rate this 1-5."

2. **Report confidence intervals** - With 307 cases, report mean +/- standard error for each metric, not just point estimates.

3. **Statistical significance testing** - Use paired t-tests or Wilcoxon signed-rank tests per category when comparing runs. Don't just eyeball deltas.

4. **Netflix's 3-phase evaluation**: Offline eval (golden set) -> Interleaving (both algorithms in one session) -> Full A/B test. We're at phase 1.

5. **"Trust buster" detection** (Netflix term) - Flag individual recommendations that would be obvious WTF moments. E.g., recommending Chess when someone asks for party games. These destroy user trust instantly even if overall metrics look fine.

### Golden Dataset Best Practices (from research)

1. **Organize by failure mode, not just topic** - Add categories for: popularity bias detection, constraint contradiction, temporal/recency bias, cross-category bridging.

2. **Include popularity bias cases** - Queries where the "right" answer is an obscure game. "I've played Terraforming Mars to death, what's similar but less known?"

3. **Include constraint contradiction cases** - "Fast party game for 2" (party games are typically 4+). Tests graceful degradation.

4. **Version and rotate** - Track when cases were added. Add new quarterly, retire stale ones.

### Critical Research Insights for Eval Design

**From the deep research report** (`docs/research/recommendation-eval-methodology.md`):

1. **Offline metrics don't reliably predict online performance** (r=0.52 to r=0.78 correlation). Use them for RELATIVE comparisons between versions, never as absolute truth.

2. **The accuracy + novelty formula**: 54 of 76 users want accurate recommendations that surface hidden gems they wouldn't find alone. "I already know about Catan" is a failure even if Catan is technically relevant.

3. **Optimal familiarity mix**: ~20-30% recognizable anchor games, ~70-80% discovery items. The familiar items validate the system's understanding; the novel items deliver value.

4. **Spotify proved diversity reduces churn by 10-20 percentage points.** Optimizing purely for relevance accuracy hurts long-term retention.

5. **74% of users want to know WHY something was recommended.** Explanation quality should be evaluated, not just relevance.

6. **LLM-as-judge best practice**: Use 0-2 scales (not 0-10), split criteria into separate evaluators, require chain-of-thought reasoning, set temperature=0, mitigate position bias by randomizing.

7. **Trust busters**: Constraint violations (recommending 6-player games for "2 players") destroy trust faster than 10 slightly-suboptimal results. Our constraint violation tracking is critical.

8. **Choice overload**: Conversion peaks at 4-6 options. Our 10-result list is fine but the UI should emphasize top 3-5.

### Eval Framework Improvements Based on Research

| Improvement | Priority | Research Basis |
|-------------|----------|---------------|
| Add serendipity metric | High | "Accuracy + novelty" is what users want |
| Add familiarity-discovery balance | High | 20-30% familiar, 70-80% discovery |
| Upgrade LLM judge to 0-2 scale per-dimension | Medium | More reliable than 0-10 single score |
| Add explanation quality evaluation | Medium | 74% of users want "why" |
| Add pairwise comparison mode | Medium | More reliable than absolute scoring |
| Track catalog coverage over time | Low | Detect popularity bias trends |

### Sources

- Netflix Recommendations: Beyond the 5 Stars (Netflix Tech Blog)
- Spotify Recommendation System (Music Tomorrow, 2025)
- Comprehensive Survey of Evaluation Techniques for Recommendation Systems (arxiv 2312.16015v2)
- Beyond-accuracy: Diversity, Serendipity, and Fairness (Frontiers in Big Data, 2023)
- Survey on LLM-as-a-Judge (arxiv 2411.15594)
- Counterfactual Evaluation for Recommendation Systems (Eugene Yan)
- Offline Evaluation of Recommender Systems (AI Magazine)
- A/B Testing for Recommender Systems (Statsig)
