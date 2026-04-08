# Architecture

System architecture for boredgame.lol. Last updated April 2026.

See also: [TECHNICAL-REVIEW-PACKET.md](TECHNICAL-REVIEW-PACKET.md) for a comprehensive review document covering architecture, evaluation, research, and known issues.

---

## High-Level Overview

```mermaid
graph TB
    subgraph Client["Browser (React 19 + MUI 7)"]
        QF["Find a Game<br/>Questionnaire"]
        RV["Results Page"]
        FB["User Feedback<br/>Thumbs up / Not This"]
        AD["Admin Debug"]
    end

    subgraph API["Next.js 16 API Routes"]
        REC["POST /api/recommend<br/>(1,227 lines)"]
    end

    subgraph AI["AI Services (OpenAI)"]
        LLM_PARSE["GPT-4.1-nano Parser<br/>Extracts structured preferences"]
        LLM_RERANK["GPT-4.1-mini Reranker<br/>Top 80 in, top 25 out"]
        LLM_EXPAND["GPT-4.1-nano Expander<br/>Creative search terms"]
        EMBED["text-embedding-3-small<br/>1536-dim vectors<br/>100% catalog coverage"]
        LLM_ENRICH["GPT-4.1-nano Enrichment<br/>Batch: moods, vibes, audiences"]
    end

    subgraph DB["Supabase PostgreSQL"]
        GAMES[("games<br/>81,039 rows")]
        EMBED_TBL[("game_embeddings<br/>pgvector HNSW<br/>768d hash + 1536d semantic")]
        META[("enriched_metadata<br/>JSONB + GIN index")]
        FEEDBACK[("user_game_feedback")]
        PROFILES[("user_profiles")]
    end

    subgraph Cache["Caching"]
        REDIS[("Upstash Redis<br/>2 min TTL")]
        MEM[("In-Memory LRU<br/>2 min TTL, max 50")]
    end

    subgraph Eval["Evaluation System"]
        CASES["3,028 Test Cases<br/>16 categories"]
        RUNNER["Eval Runner<br/>Parallel, LLM judge"]
        METRICS["IR Metrics + Analysis"]
    end

    QF -->|"freeText + prefs"| REC
    RV -->|"freeText + prefs"| REC
    FB -->|"rating: 1/-1"| FEEDBACK
    AD -->|"freeText + _nocache"| REC

    REC --> LLM_PARSE
    REC --> LLM_EXPAND
    REC --> LLM_RERANK
    REC --> EMBED_TBL
    REC --> GAMES
    REC --> META
    REC --> FEEDBACK

    LLM_PARSE -.->|"genres, mechanics,<br/>keywords, intent"| REC
    LLM_EXPAND -.->|"expanded search terms"| REC
    LLM_RERANK -.->|"reordered top 25"| REC
    EMBED_TBL -.->|"250 vector matches"| REC
    LLM_ENRICH -.->|"batch offline"| META

    REC <--> MEM
    REC <--> REDIS

    CASES --> RUNNER
    RUNNER -->|"POST /api/recommend"| REC
    RUNNER --> METRICS
```

---

## Recommendation Pipeline (9 Stages)

```mermaid
flowchart TD
    INPUT["User Query<br/>'a fun anime board game for 4 players'"]

    subgraph S1["Stage 1: LLM Preference Parsing"]
        LLM["GPT-4o-mini extracts structured prefs"]
        MERGE["Merge genres, mechanics, gameTypes,<br/>intentModifiers, comparisonBase"]
    end

    subgraph S2["Stage 2: Similar-To Bootstrapping"]
        BOOT["Fetch referenced game's full profile<br/>Inherit complexity, time, players<br/>Boost core mechanics 1.5x"]
    end

    subgraph S3["Stage 3: Cache Check"]
        KEY["Cache key from<br/>freeText + parsed genres + prefs"]
        HIT{Cache hit?}
    end

    subgraph S4["Stage 4: Candidate Fetching (6 parallel sources)"]
        VEC["pgvector Semantic (250)"]
        TAG["GIN Tag Search (150)"]
        TXT["Full-Text Search (50)"]
        MECH["Mechanic Search (100)"]
        DES["Designer Search (100)"]
        EXP["LLM Query Expansion (50)"]
        FALLBACK["Popularity Fallback<br/>(only if < 30 total)"]
    end

    subgraph S5["Stage 5: Hard Constraint Filtering"]
        FILT["Filter by: player count, time,<br/>complexity, game type,<br/>expansion removal"]
    end

    subgraph S6["Stage 6: Adaptive Weight Computation"]
        AW["Amplify weights by query specificity<br/>then renormalize to 100%"]
    end

    subgraph S7["Stage 7: Scoring (10 dimensions)"]
        S_ALL["10 weighted dimensions<br/>Genre 26%, FreeText 22%, Type 10%<br/>Players 8%, Mood 8%, Time 7%<br/>Complexity 7%, Pop 6%, Quality 3%<br/>Recency 3% + intent modifiers"]
    end

    subgraph S8["Stage 8: Multi-Signal Re-Ranking"]
        SIM["Similarity Re-rank (65% rule + 35% cosine)"]
        CF["Collaborative Filtering (+15% boost)"]
        REJ["Rejection Penalties"]
        RERANK["LLM Re-Rank (80 in, 25 out)"]
    end

    subgraph S9["Stage 9: Diversity Enforcement"]
        DIV["MMR: 80% relevance + 20% novelty"]
    end

    OUTPUT["Final Results (up to 100 games)<br/>Scores, reasons, breakdowns"]

    INPUT --> LLM --> MERGE --> BOOT --> KEY --> HIT
    HIT -->|Yes| OUTPUT
    HIT -->|No| VEC & TAG & TXT & MECH & DES & EXP
    S4 --> FALLBACK --> FILT --> AW --> S_ALL
    S_ALL --> SIM --> CF --> REJ --> RERANK --> DIV --> OUTPUT
```

### Candidate Deduplication

Deduplication happens **per-request, in-memory** -- not as a batch or offline process. This is necessary because the 7+ parallel candidate sources (franchise, canonical, designer, mechanic, vector, tag, text, LLM expansion) can each return the same game.

- **How:** A `Set<string>` of game IDs merges candidates in priority order: franchise > canonical > designer > mechanic > vector > tag > text > expanded. The first source to contribute a game "wins" its priority slot.
- **Cost:** O(1) per game via `Set.has()`. With ~600 total candidates across all sources, dedup takes microseconds -- negligible compared to DB queries and LLM calls.
- **Why per-request?** Candidate composition changes with every query. A popular strategy game like Catan might appear in vector results, tag results, AND text results for one query but only in vector results for another.

---

## Data Sources & Ingestion

```mermaid
flowchart LR
    subgraph Sources["External APIs"]
        BGG["BoardGameGeek<br/>65k board games"]
        IGDB_S["IGDB (Twitch)<br/>11k video games"]
        RAWG_S["RAWG<br/>3.7k video games"]
        LOCAL["Curated JSON<br/>47 word/party games"]
    end

    subgraph Adapters["Adapter Pattern"]
        A["Each source implements<br/>GameAdapter interface<br/>Normalizes to unified Game type"]
    end

    subgraph Storage["Supabase PostgreSQL"]
        GAMES_T["games: 81k rows<br/>Full metadata per game"]
        EMBED_T["game_embeddings<br/>pgvector HNSW index<br/>768-dim + 1536-dim vectors"]
        META["enriched_metadata (JSONB)<br/>LLM-generated moods and vibes"]
    end

    Sources --> Adapters --> GAMES_T
    GAMES_T --> EMBED_T
    GAMES_T -.->|GPT-4o-mini batch| META
```

---

## Caching Architecture

```mermaid
flowchart TD
    REQ["Incoming /api/recommend Request"]

    LLM_P["LLM Parse freeText"]
    MERGE_G["Merge genres/mechanics<br/>into body"]

    subgraph Key["Cache Key = JSON of:"]
        K["Hash of all user preferences<br/>freeText, genres, moods, etc."]
    end

    L1["In-Memory Cache<br/>TTL: 120s, max 50 entries<br/>Cleared on server restart"]
    L2["Upstash Redis<br/>TTL: 120s<br/>Persists across restarts"]

    ENGINE["Full Pipeline<br/>(~5-12 seconds)"]

    BYPASS["_nocache: true<br/>Skips both layers"]

    REQ --> LLM_P --> MERGE_G --> Key
    Key --> L1
    L1 -->|Hit| RETURN["Return cached"]
    L1 -->|Miss| L2
    L2 -->|Hit| RETURN
    L2 -->|Miss| ENGINE
    ENGINE -->|Store| L1 & L2
    ENGINE --> RETURN
    BYPASS -.->|Skip| ENGINE

    style BYPASS fill:#ff6b6b,color:#fff
```

---

## User Feedback Loop

```mermaid
flowchart TD
    subgraph Actions["User Actions"]
        UP["Thumbs Up<br/>(rating: 1)"]
        DOWN["Not This<br/>(rating: -1)"]
    end

    subgraph Storage["user_game_feedback table"]
        FB["user_id + game_id + rating"]
    end

    subgraph Effects["Impact on Recommendations"]
        CF["Collaborative Filtering<br/>Similar users boost, +15% score"]
        REJ["Rejection Learning<br/>Tag penalty from dismissed games"]
    end

    UP --> FB --> CF
    DOWN --> FB --> REJ
```

---

## Scoring Weight Distribution

```mermaid
pie title Default Scoring Weights (sum = 100%)
    "Genre Match" : 26
    "Free Text" : 22
    "Type Match" : 10
    "Player Count" : 8
    "Mood" : 8
    "Time Fit" : 7
    "Complexity" : 7
    "Popularity" : 6
    "Quality" : 5
    "Recency" : 1
```

Weights are adaptive: if the user specifies a tight player count (e.g., exactly 4), that dimension gets a 2x boost, then all weights renormalize to 100%. Additional adaptive rules:
- Hard time constraint ("under 90 min"): time weight gets 2.5x boost
- Narrow complexity range: complexity weight gets 2x boost
- Broad query (few constraints): quality and popularity each get 4x boost as tiebreaker
- Multiple moods specified: mood weight gets 1.5x boost

**Hidden Gems mode** uses a different base profile: popularity drops to 0%, quality rises to 15%.

---

## Evaluation System

The eval system measures recommendation quality objectively. It runs real queries against the API and checks results against curated ground truth.

```mermaid
graph TB
    subgraph Generation["Test Case Generation"]
        HAND["130 Hand-Curated<br/>Expert-graded, relevance 0-3"]
        EXPAND["177 Systematic Variations<br/>Player/time/complexity combos"]
        LLM_GEN["~2,700 LLM-Generated<br/>GPT-4o, validated against DB"]
    end

    subgraph Cases["3,028 Eval Cases (16 categories)"]
        STRUCT["Each case:<br/>query + idealGames + antiGames<br/>+ constraints + tags"]
    end

    subgraph Runner["Eval Pipeline"]
        PARALLEL["Parallel execution (5-8 concurrent)"]
        API["POST /api/recommend (_nocache)"]
        JUDGE["LLM Judge (GPT-4o-mini, 0-10)"]
        CONSTRAINT["Constraint Checker"]
        IR["NDCG, MRR, Precision, Hit Rate"]
    end

    subgraph Output["Results"]
        RUNS["evals/runs/*.json"]
        LOGS["evals/logs/*.log"]
        REGRESSION["Regression tracking<br/>vs previous run"]
    end

    subgraph Analysis["Analysis Tools"]
        SUMMARY["summary.ts"]
        COMPARE["compare-runs.ts"]
        FAILURES["analyze-failures.ts"]
    end

    Generation --> Cases --> PARALLEL --> API
    API --> JUDGE & CONSTRAINT & IR
    JUDGE & CONSTRAINT & IR --> RUNS & LOGS & REGRESSION
    RUNS --> Analysis
```

**Current baseline (307 cases):** 68.4% pass rate, 7.14/10 LLM judge, 0.9855 NDCG@10, 1.0% constraint violations.

See [evals/EVAL-OVERVIEW.md](../evals/EVAL-OVERVIEW.md) for the complete eval system guide and [TECHNICAL-REVIEW-PACKET.md](TECHNICAL-REVIEW-PACKET.md) for detailed results and analysis.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Server components, API routes, SSR |
| UI | React 19 + MUI 7 | Material Design components |
| Language | TypeScript 5 | Strict mode |
| Auth | Supabase Auth | Email/password + Google OAuth |
| Database | Supabase PostgreSQL | Games, user profiles, feedback |
| Vector Search | pgvector (HNSW) | 768-dim hash + 1536-dim semantic embeddings |
| AI | OpenAI (GPT-4o, GPT-4o-mini) | Parsing, reranking, query expansion, enrichment |
| Embeddings | text-embedding-3-small | 1536-dim semantic vectors |
| Cache | Upstash Redis + in-memory | 2 min TTL, 50-entry in-memory LRU |
| Animations | Motion (Framer Motion) | Page transitions, scroll animations |
| Testing | Vitest + React Testing Library | Unit + integration tests |
| Deployment | Vercel | Serverless functions |

---

## Key File Locations

| Area | Files |
|------|-------|
| **Recommendation API** | `src/app/api/recommend/route.ts` |
| **Scoring Engine** | `src/lib/recommendation/scoring.ts` |
| **LLM Parser** | `src/lib/llm/parse-preferences.ts` |
| **LLM Reranker** | `src/lib/recommendation/llm-rerank.ts` |
| **Vector Similarity** | `src/lib/recommendation/similarity.ts`, `semantic-embeddings.ts` |
| **Collaborative Filter** | `src/lib/recommendation/collaborative.ts` |
| **Rejection Learning** | `src/lib/recommendation/rejection.ts` |
| **Diversity** | `src/lib/recommendation/diversity.ts` |
| **Query Expansion** | `src/lib/recommendation/llm-query-expand.ts` |
| **Redis Cache** | `src/lib/redis.ts` |
| **BGG Adapter** | `src/lib/adapters/bgg.ts` |
| **IGDB Adapter** | `src/lib/adapters/igdb.ts` |
| **Game DB Layer** | `src/lib/supabase/games.ts` |
| **Admin Debug** | `src/app/admin/debug/page.tsx` |
| **Results Page** | `src/app/results/ResultsView.tsx` |
| **Questionnaire** | `src/app/find-a-game/QuestionnaireFlow.tsx` |
