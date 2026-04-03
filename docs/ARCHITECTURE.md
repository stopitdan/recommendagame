# Architecture

System architecture for boredgame.lol. Last updated April 2026.

---

## High-Level Overview

```mermaid
graph TB
    subgraph Client["Browser"]
        QF[Find a Game<br/>Questionnaire]
        RV[Results Page]
        AD[Admin Debug]
    end

    subgraph API["Next.js API Routes"]
        REC["/api/recommend"]
    end

    subgraph AI["AI Services (OpenAI)"]
        LLM_PARSE["LLM Parser<br/>Preference extraction"]
        LLM_RERANK["LLM Reranker<br/>Common-sense ordering"]
        LLM_EXPAND["Query Expander<br/>Creative search terms"]
        EMBED["Semantic Embeddings<br/>1536-dim vectors"]
    end

    subgraph DB["Supabase PostgreSQL"]
        GAMES[(games<br/>81k rows)]
        EMBED_TBL[(game_embeddings<br/>pgvector HNSW)]
        FEEDBACK[(user_game_feedback)]
        PROFILES[(user_profiles)]
    end

    subgraph Cache["Caching"]
        REDIS[("Upstash Redis<br/>2 min TTL")]
        MEM[("In-Memory<br/>2 min TTL")]
    end

    QF -->|freeText + prefs| REC
    RV -->|freeText + prefs| REC
    AD -->|freeText + _nocache| REC

    REC --> LLM_PARSE
    REC --> LLM_EXPAND
    REC --> LLM_RERANK
    REC --> EMBED_TBL
    REC --> GAMES
    REC --> FEEDBACK

    LLM_PARSE -.->|genres, mechanics,<br/>keywords, time| REC
    LLM_EXPAND -.->|expanded search terms| REC
    LLM_RERANK -.->|reordered top 25| REC
    EMBED_TBL -.->|250 vector matches| REC

    REC <--> MEM
    REC <--> REDIS
```

---

## Recommendation Pipeline

```mermaid
flowchart TD
    INPUT["User Query<br/>'a fun anime board game for 4 players'"]

    subgraph PARSE["Step 1: Parse & Understand"]
        LLM["LLM Parser"]
        MERGE["Merge parsed genres, mechanics,<br/>gameTypes into body"]
    end

    subgraph CACHE_CHECK["Step 2: Cache Check"]
        KEY["Cache key from<br/>freeText + parsed genres + prefs"]
        HIT{Cache hit?}
    end

    subgraph FETCH["Step 3: Relevance-First Candidate Fetching (parallel)"]
        VEC["Vector Search<br/>(pgvector, 250)"]
        TAG["Tag Search<br/>(categories/mechanics/themes)"]
        TXT["Text Search<br/>(name + description)"]
        MECH["Mechanic Search"]
        DES["Designer Search"]
        EXP["LLM Query Expansion"]
        FALLBACK["Popularity Fallback<br/>(only if < 30 candidates)"]
    end

    subgraph FILTER["Step 4: Hard Filters"]
        FILT["Player count, time range,<br/>complexity, game type,<br/>mechanic match, excluded genres"]
    end

    subgraph SCORE["Step 5: Scoring (10 dimensions)"]
        S_ALL["Genre (28%) + FreeText (22%) +<br/>Type (10%) + Players (8%) +<br/>Mood (8%) + Time (7%) +<br/>Complexity (7%) + Pop (4%) +<br/>Quality (3%) + Recency (3%)"]
    end

    subgraph POST["Step 6: Post-Processing"]
        GENRE_FILTER["Remove 0-genre-match games"]
        SIM["Semantic Similarity Re-rank<br/>(55% rule + 45% similarity)"]
        CF["Collaborative Filtering Boost"]
        REJ["Rejection Penalties"]
        RERANK["LLM Re-Rank<br/>(top 60 in, top 25 out)"]
        DIV["Diversity Re-Rank"]
    end

    OUTPUT["Final Results (up to 100 games)"]

    INPUT --> LLM --> MERGE --> KEY --> HIT
    HIT -->|Yes| OUTPUT
    HIT -->|No| VEC & TAG & TXT & MECH & DES & EXP
    FETCH --> FALLBACK --> FILT --> S_ALL
    S_ALL --> GENRE_FILTER --> SIM --> CF --> REJ --> RERANK --> DIV --> OUTPUT
```

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
        GAMES_T["games (81k rows)<br/>id, name, description,<br/>playerCount, playTime,<br/>complexity, categories,<br/>mechanics, themes, rating"]
        EMBED_T["game_embeddings<br/>pgvector HNSW index<br/>768-dim + 1536-dim vectors"]
        META["enriched_metadata (JSONB)<br/>LLM-generated moods,<br/>vibe keywords, audiences,<br/>similar games"]
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
        K["freeText + gameTypes +<br/>playerCount + timePresets +<br/>complexity + genres +<br/>moods + popularity"]
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
        CF["Collaborative Filtering<br/>Finds users with similar likes<br/>Boosts games they also liked<br/>(+15% score)"]
        REJ["Rejection Learning<br/>Builds tag profile from dismissed games<br/>Only activates after 2+ rejections<br/>of same tag (max 50% penalty)"]
    end

    UP --> FB --> CF
    DOWN --> FB --> REJ
```

---

## Scoring Weight Distribution

```mermaid
pie title Default Scoring Weights (sum = 100%)
    "Genre Match" : 28
    "Free Text" : 22
    "Type Match" : 10
    "Player Count" : 8
    "Mood" : 8
    "Time Fit" : 7
    "Complexity" : 7
    "Popularity" : 4
    "Quality" : 3
    "Recency" : 3
```

Weights are adaptive: if the user specifies a tight player count (e.g., exactly 4), that dimension gets a 2x boost, then all weights renormalize to 100%.

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
