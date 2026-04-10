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

    subgraph Cache["6-Layer Smart Cache"]
        CLIENT[("Client SWR<br/>60s stale")]
        MEM[("In-Memory LRU<br/>2 min TTL")]
        REDIS[("Upstash Redis<br/>2-15 min TTL")]
        SEM[("Semantic Cache<br/>Redis 10m + Supabase 24h")]
        RERANK_C[("LLM Rerank Cache<br/>Redis 10 min")]
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

    subgraph S4["Stage 4: Candidate Fetching (6 parallel retrieval strategies)"]
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

> **"Data sources" vs. "retrieval strategies"** -- these are different things. Data sources (BGG, IGDB, RAWG, local JSON) are where games are *imported from* during batch ingestion. They all land in a single unified `games` table (81k rows). Retrieval strategies are the 7+ different *ways of querying that same table* at recommendation time. Dedup is about the latter, not the former.

All 81k games live in one table. There's no duplication problem at the storage level. The dedup problem arises because we query that single table through multiple retrieval strategies in parallel, and those strategies return overlapping results. For example, a query about "deck building games" might find Dominion via:

- **Vector search** (semantic embedding is close to "deck building")
- **Tag search** (has "Deck Building" in its mechanics array)
- **Mechanic search** (direct mechanic overlap with aliases)
- **Text search** ("Dominion" matched by name)
- **Canonical games** (hardcoded as the quintessential deck builder)

That's the same game appearing in 5 result sets from 5 different queries against the same table.

**Why not just run one big query?** Each retrieval strategy uses different indexes and matching logic (pgvector HNSW for vectors, GIN for array overlaps, full-text search for names/descriptions, ILIKE for designers). There's no single SQL query that efficiently combines all of these. Running them in parallel with different indexes is faster than one monolithic query scoring all 81k games.

**How dedup works:** A `Set<string>` of game IDs merges candidates in priority order: franchise > canonical > designer > mechanic > vector > tag > text > expanded. The first strategy to contribute a game "wins" its slot. This is just bookkeeping about insertion order -- it doesn't affect final scoring or ranking.

**Cost:** O(1) per game via `Set.has()`. With ~600 total candidates across all strategies, dedup takes microseconds -- negligible compared to DB queries and LLM calls.

**Why per-request?** Which strategies find which games changes with every query. Catan might appear in vector, tag, AND text results for one query but only vector results for another.

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

## Caching Architecture (6-Layer Smart Cache Stack)

The caching system spans from the browser through the API into persistent storage. The "smart" layer (Semantic Recommendation Cache) uses canonical keys derived from LLM-parsed preferences, so different phrasing of the same request ("deck building for 2" vs "2 player deck builders") produces cache hits.

```mermaid
flowchart TD
    REQ["Incoming Request"]

    subgraph Client["Browser Cache"]
        CC["Client-Side Fetch Cache<br/>Module-level Map, stale-while-revalidate<br/>60s stale threshold"]
    end

    subgraph API["API Route Handler"]
        BYPASS{"Cache Bypass?<br/>cookie / header / param"}
    end

    subgraph Exact["Layer 1-2: Exact Match"]
        L1["In-Memory Cache<br/>TTL: 2 min, max 50 entries"]
        L2["Upstash Redis<br/>TTL: 2-15 min by route"]
    end

    subgraph Semantic["Layer 3-4: Semantic Cache (Smart)"]
        SEM_R["Redis: Canonical Key<br/>TTL: 10 min"]
        SEM_DB["Supabase: recommendation_cache<br/>Persistent, 24hr staleness"]
    end

    subgraph LLM["Layer 5: LLM Rerank Cache"]
        RERANK["Redis: Candidate IDs + Pref Hash<br/>TTL: 10 min, temperature=0"]
    end

    ENGINE["Full Pipeline<br/>(~5-12 seconds)"]

    REQ --> CC
    CC -->|Miss or Stale| API
    API --> BYPASS
    BYPASS -->|No| L1
    BYPASS -->|"Yes (admin)"| ENGINE
    L1 -->|Hit| RETURN["Return cached<br/>x-cache: HIT"]
    L1 -->|Miss| L2
    L2 -->|Hit| RETURN
    L2 -->|Miss| SEM_R
    SEM_R -->|Hit| RETURN
    SEM_R -->|Miss| SEM_DB
    SEM_DB -->|Hit| RETURN
    SEM_DB -->|Miss| ENGINE
    ENGINE -->|Store all layers| L1 & L2 & SEM_R & SEM_DB
    RERANK -.->|"Skips 1-3s LLM call"| ENGINE

    style BYPASS fill:#ff6b6b,color:#fff
    style SEM_R fill:#4CAF50,color:#fff
    style SEM_DB fill:#4CAF50,color:#fff
```

### Cache Layers

| Layer | Location | TTL | What It Caches |
|-------|----------|-----|----------------|
| Client fetch cache | Browser Map | 60s stale | All GET responses (trending, browse, game detail, similar) |
| In-memory (exact match) | Server MemoryCache | 2 min | Recommend responses, identical raw prefs |
| Redis (exact match) | Upstash | 2-15 min | Per-route: recommend (2m), browse (15m), trending (6h), game detail (10m) |
| Semantic cache (Redis) | Upstash | 10 min | Canonical parsed prefs (cross-user, different text = same key) |
| Semantic cache (Supabase) | `recommendation_cache` table | 24h stale | Persistent across deploys, survives Redis eviction |
| LLM rerank cache | Upstash | 10 min | Reranking results keyed by candidate IDs + preference summary |

### Cache Bypass (Admin)

Admins can bypass all caching for testing via any of:
- **Cookie**: `__nocache=1` (toggled via profile dropdown "Skip Cache" switch)
- **Header**: `X-No-Cache: 1`
- **Query param**: `?nocache=1`

When bypass is active, cache reads are skipped but writes still execute (so other users benefit from the fresh computation). All API responses include an `x-cache: HIT` or `x-cache: MISS` header for debugging.

### Semantic Cache: How "Smart" Works

1. User types "deck building games for 2 players"
2. LLM parses to: `{ mechanics: ["Deck Building"], playerCount: {min:2, max:2} }`
3. Canonical key built from parsed prefs (freeText deliberately excluded)
4. Hash checked against Redis, then Supabase `recommendation_cache`
5. Another user types "2 player deck builders" -- same canonical key -- instant hit

The canonical key includes: sorted gameTypes, genres, mechanics, moods, playerCount, complexity, timePresets, similarTo, designers, keywords, and popularity mode. Default/empty values are omitted to maximize hit rates.

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
| Cache | 6-layer smart cache stack | Client SWR + in-memory + Redis + semantic (Redis + Supabase) + LLM rerank cache |
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
| **Cache Bypass** | `src/lib/cache-bypass.ts` |
| **Semantic Cache** | `src/lib/recommendation/semantic-cache.ts` |
| **Client Cache** | `src/lib/client-cache.ts`, `src/hooks/useCachedFetch.ts` |
| **BGG Adapter** | `src/lib/adapters/bgg.ts` |
| **IGDB Adapter** | `src/lib/adapters/igdb.ts` |
| **Game DB Layer** | `src/lib/supabase/games.ts` |
| **Admin Debug** | `src/app/admin/debug/page.tsx` |
| **Results Page** | `src/app/results/ResultsView.tsx` |
| **Questionnaire** | `src/app/find-a-game/QuestionnaireFlow.tsx` |
