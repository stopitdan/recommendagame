# Start Here: Technical Review Guide

Welcome. This is a game recommendation engine at [boredgame.lol](https://boredgame.lol). It was built by one person with AI assistance (vibe-coded). The goal of this review is to find fundamental mistakes, validate the approach, and prioritize improvements.

---

## What to Read (in order)

### 1. The Review Packet (START HERE)
**[TECHNICAL-REVIEW-PACKET.md](TECHNICAL-REVIEW-PACKET.md)** -- The main document. Contains:
- Complete system architecture with Mermaid diagrams
- 9-stage recommendation pipeline walkthrough
- 10-dimension scoring system explained
- Evaluation system architecture and results
- Research papers that informed the design
- Known issues (self-diagnosed)
- Specific questions for reviewers

**Time to read: ~20 minutes**

### 2. Architecture Diagrams
**[ARCHITECTURE.md](ARCHITECTURE.md)** -- Visual-heavy system overview with 8 Mermaid diagrams covering the full stack from browser to database to eval system.

**Time to read: ~10 minutes**

### 3. Recommendation Engine Design
**[RECOMMENDATION-ENGINE.md](RECOMMENDATION-ENGINE.md)** -- The 4-layer recommendation system: rule-based scoring, vector similarity, collaborative filtering, and LLM enhancement. Includes current constants, adaptive weight rules, and gaps vs. literature.

**Time to read: ~10 minutes**

### 4. Evaluation System
**[../evals/EVAL-OVERVIEW.md](../evals/EVAL-OVERVIEW.md)** -- How we measure recommendation quality. 3,028 test cases, IR metrics, LLM-as-judge, per-category breakdown, iteration history, and the eval-driven improvement cycle.

**Time to read: ~15 minutes**

### 5. Research Foundation
**[RECOMMENDATION-ENGINE-RESEARCH.md](RECOMMENDATION-ENGINE-RESEARCH.md)** -- Deep analysis comparing the engine against academic literature (Raza et al. 287-paper survey, Koch/Criteo practitioner guide, game-specific studies, LLM+RecSys 2024-2025 papers). Identifies 7 failure modes with root causes and 10 ranked improvements.

**Time to read: ~20 minutes**

### 6. Eval Methodology Research
**[research/recommendation-eval-methodology.md](research/recommendation-eval-methodology.md)** -- How Netflix, Spotify, and YouTube evaluate recommendations. Covers offline vs. online correlation, beyond-accuracy metrics (diversity, serendipity, novelty), LLM-as-judge best practices, human psychology of recommendations, and a concrete implementation plan.

**Time to read: ~25 minutes**

---

## Quick Facts

| | |
|-|-|
| **Games indexed** | 81,039 (board + video) |
| **Data sources** | BoardGameGeek, IGDB, RAWG, curated JSON |
| **Recommendation latency** | p50: 9.6s, p95: 12.3s |
| **Eval cases** | 3,028 across 16 categories |
| **Eval pass rate** | 68.4% (307-case validated subset) |
| **LLM judge score** | 7.14/10 |
| **NDCG@10** | 0.9855 |
| **Constraint violation rate** | 1.0% |
| **Catalog coverage** | 0.5% (known critical issue) |
| **Biggest weakness** | Missing famous games (Dominion, Codenames, Azul) |
| **Biggest strength** | Handles edge cases perfectly, zero cross-type contamination |

---

## What I Want Feedback On

1. **Is the recommendation architecture sound?** Are there fundamental design flaws in the 9-stage pipeline?
2. **Is the eval methodology measuring the right things?** Are there blind spots?
3. **Are the scoring weights and pipeline stages ordered correctly?**
4. **What would you change first** if you inherited this codebase?
5. **Are there obvious best practices I'm violating?**

See the bottom of [TECHNICAL-REVIEW-PACKET.md](TECHNICAL-REVIEW-PACKET.md) for more specific questions.

---

## Optional Deep Dives

| Document | What It Covers |
|----------|---------------|
| [DECISIONS.md](DECISIONS.md) | Architecture Decision Records (ADRs) -- why Supabase over Firebase, adapter pattern, etc. |
| [../evals/RECOMMENDATIONS.md](../evals/RECOMMENDATIONS.md) | 7 specific engine improvements prioritized by eval data |
| [../evals/EVAL-WORKLOG.md](../evals/EVAL-WORKLOG.md) | Narrative log of every eval finding and decision |
| [SESSION-6-HANDOFF.md](SESSION-6-HANDOFF.md) | Most recent development session: research-driven engine overhaul |
| [MASTER-TODO.md](MASTER-TODO.md) | Full project tracking across 10 phases |

---

## Codebase Entry Points

If you want to read the actual code:

| What | File | Lines |
|------|------|-------|
| **The main recommendation API** | `src/app/api/recommend/route.ts` | 1,227 |
| **The scoring engine** | `src/lib/recommendation/scoring.ts` | 1,230 |
| **The eval runner** | `evals/runner.ts` | 626 |
| **LLM preference parser** | `src/lib/llm/parse-preferences.ts` | ~300 |
| **Vector similarity** | `src/lib/recommendation/similarity.ts` | 246 |
| **Eval test cases** | `evals/cases.json` | 3,028 cases |
