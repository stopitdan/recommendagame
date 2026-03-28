# Architecture

System architecture and technical decisions for boredgame.lol.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Server components, API routes, SSR |
| UI | React 19 + MUI 7 | Material Design component library |
| Language | TypeScript 5 | Strict mode enabled |
| Auth | Supabase Auth | Email/password + Google OAuth (replaces Firebase Auth plan) |
| Database | Supabase (PostgreSQL + pgvector) | Games, user profiles, preferences, vector similarity search |
| Vector Search | pgvector extension | Cosine similarity for recommendation engine |
| Caching | TBD | Redis, SQLite, or in-memory |
| Deployment | TBD (likely Vercel) | |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                    │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Pages /  │  │ Question │  │  Game Detail   │  │
│  │ Landing  │  │  Flow    │  │    Pages       │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐  │
│  │           Recommendation Engine             │  │
│  │  (rule-based → content → collaborative)     │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐  │
│  │           Unified Search Service            │  │
│  │              /api/games/*                   │  │
│  └──┬──────────────┬──────────────────┬───────┘  │
│     │              │                  │          │
│  ┌──▼───┐  ┌──────▼──────┐  ┌───────▼───────┐  │
│  │ BGG  │  │    RAWG     │  │  Word Games   │  │
│  │Adapt.│  │   Adapter   │  │   Adapter     │  │
│  └──┬───┘  └──────┬──────┘  └───────┬───────┘  │
│     │              │                  │          │
│  ┌──▼──────────────▼──────────────────▼───────┐  │
│  │              Cache Layer                    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │      Supabase (Postgres + pgvector)        │  │
│  │  Auth │ Games DB │ User Data │ Vectors     │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │              │                │
         ▼              ▼                ▼
   BoardGameGeek    RAWG API      Local Dataset
    XML API2        (REST)        (word games)
```

---

## Directory Structure (planned)

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx            # Landing page
│   ├── login/
│   ├── signup/
│   ├── questionnaire/      # Multi-step recommendation flow
│   ├── results/            # Recommendation results
│   ├── games/[id]/         # Game detail pages
│   └── api/                # API routes
│       └── games/
│           ├── search/
│           └── [id]/
├── components/             # Shared UI components
│   ├── ThemeRegistry.tsx
│   ├── GameCard.tsx
│   ├── FilterSidebar.tsx
│   └── QuestionStep.tsx
├── lib/                    # Core business logic
│   ├── adapters/           # API adapters
│   │   ├── bgg.ts
│   │   ├── rawg.ts
│   │   └── wordgames.ts
│   ├── cache/              # Caching layer
│   ├── recommendation/     # Recommendation engine
│   │   ├── scoring.ts
│   │   ├── content-based.ts
│   │   └── collaborative.ts
│   └── supabase/           # Supabase config & helpers
│       ├── client.ts       # Browser client
│       ├── server.ts       # Server-side client
│       └── middleware.ts   # Auth token refresh
├── contexts/               # React contexts
│   └── AuthContext.tsx
├── types/                  # TypeScript type definitions
│   ├── game.ts
│   └── user.ts
└── theme.ts
```

---

## Key Design Decisions

### Adapter Pattern for APIs
Each external data source gets its own adapter that implements a common interface. This keeps the rest of the app decoupled from any specific API's quirks (XML vs JSON, different field names, etc.).

### Cache-First Strategy
External APIs are slow and rate-limited. The app should:
1. Check cache first
2. Return cached data if fresh
3. Fetch from API only on cache miss
4. Store result in cache with TTL

### Progressive Recommendation Complexity
Start with simple rule-based scoring (Phase 4a). Layer on content-based filtering once game metadata is rich enough. Only add collaborative filtering once there's a meaningful user base. This avoids over-engineering early.

### Guest-First UX
Users should get value immediately without signing up. Auth is for persistence, not gatekeeping.
