# Meilisearch Setup Guide

If browse/search performance degrades (target: <500ms), add Meilisearch as a dedicated search layer. This supplements Supabase — it doesn't replace it.

> **Note:** As of migration 028, pg_trgm provides typo-tolerant fuzzy search as a fallback when tsvector exact matching returns no results. This covers the "Bertrayal" → "Betrayal" use case without additional infrastructure. Meilisearch would still be an upgrade for sub-50ms latency, faceted filtering, and more advanced typo tolerance at scale.

## What Meilisearch Does
- Handles all browse page queries (text search + faceted filtering)
- Sub-50ms search latency on 1M+ documents
- Built-in typo tolerance ("holow knght" → "Hollow Knight")
- Faceted filtering (player count, complexity, rating, categories, mechanics)
- Supabase stays as source of truth for auth, user data, reviews, embeddings, recommendations

## Cost Options

| Option | Cost/mo | Docs Limit | Setup Time | Ops Burden |
|--------|---------|------------|------------|------------|
| Self-hosted (Hetzner CX22) | $6 | Unlimited | 1-2 hrs | You manage server |
| Self-hosted (DigitalOcean) | $6-12 | Unlimited | 1-2 hrs | You manage server |
| Self-hosted (Railway) | $5-15 | Unlimited | 30 min | Minimal |
| Meilisearch Cloud Build | $30 | 100k docs | 10 min | Zero |
| Meilisearch Cloud Pro | $300 | 1M docs | 10 min | Zero |

**Recommendation:** Self-hosted on Railway or Hetzner ($5-12/mo) for our 178k+ games.

## Self-Hosted Setup (Cheapest)

### Option A: Railway (easiest)
1. Go to https://railway.app
2. Click "New Project" → "Docker Image"
3. Image: `getmeili/meilisearch:latest`
4. Add env var: `MEILI_MASTER_KEY=your-secret-key-here`
5. Deploy — Railway gives you a public URL
6. Add to `.env.local` and Vercel:
   ```
   MEILISEARCH_HOST=https://your-railway-url.railway.app
   MEILISEARCH_API_KEY=your-secret-key-here
   ```

### Option B: Hetzner/DigitalOcean VPS
1. Create a $6/mo server (2 vCPU, 4GB RAM)
2. SSH in and install:
   ```bash
   curl -L https://install.meilisearch.com | sh
   MEILI_MASTER_KEY=your-secret-key ./meilisearch --env production
   ```
3. Set up a reverse proxy (nginx/caddy) for HTTPS
4. Add env vars same as above

### Option C: Meilisearch Cloud
1. Go to https://cloud.meilisearch.com
2. Create a project
3. Copy the host URL and API key
4. Add env vars same as above

## Integration Code (already planned)

After setting up Meilisearch, these files need to be created/modified:

### New Files
- `src/lib/meilisearch/client.ts` — Meilisearch client singleton
- `src/lib/meilisearch/sync.ts` — sync logic (Supabase → Meilisearch)
- `scripts/sync-meilisearch.ts` — batch sync script

### Modified Files
- `src/app/api/games/browse/route.ts` — try Meilisearch first, fall back to Supabase
- `src/app/api/games/search/route.ts` — same pattern
- `package.json` — add `meilisearch` dependency

### Meilisearch Index Configuration
```javascript
// Index settings (set once during initial sync)
{
  searchableAttributes: ['name', 'description', 'categories', 'mechanics', 'themes'],
  filterableAttributes: [
    'types', 'categories', 'mechanics', 'themes', 'platforms',
    'rating', 'rating_count', 'complexity',
    'min_players', 'max_players', 'year_published'
  ],
  sortableAttributes: ['rating', 'rating_count', 'name', 'year_published'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']
}
```

### Client Module
```typescript
// src/lib/meilisearch/client.ts
import { MeiliSearch } from 'meilisearch';

let client: MeiliSearch | null = null;

export function getMeiliClient(): MeiliSearch | null {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_API_KEY;
  if (!host) return null;
  if (!client) client = new MeiliSearch({ host, apiKey });
  return client;
}

export const GAMES_INDEX = 'games';
```

### Browse Route Pattern
```typescript
// In src/app/api/games/browse/route.ts
import { getMeiliClient, GAMES_INDEX } from '@/lib/meilisearch/client';

export async function GET(request: NextRequest) {
  // ... parse params ...

  // Try Meilisearch first (sub-50ms)
  const meili = getMeiliClient();
  if (meili) {
    try {
      const index = meili.index(GAMES_INDEX);
      const results = await index.search(textQuery ?? '', {
        filter: buildMeiliFilter(params),  // e.g. "types = 'board' AND rating_count > 50"
        sort: [sort === 'rating' ? 'rating:desc' : 'rating_count:desc'],
        limit,
        offset,
      });
      // Transform and return results
    } catch {
      // Fall through to Supabase
    }
  }

  // Supabase fallback (existing code)
}
```

### Sync Script
```typescript
// scripts/sync-meilisearch.ts
// Reads all games from Supabase, indexes into Meilisearch
// Run after: BGG crawler finishes, IGDB crawler finishes, or data changes
// Takes ~2-5 minutes for 178k games
```

### Keeping In Sync
- **Manual:** Run `npx tsx scripts/sync-meilisearch.ts` after data changes
- **Cron:** Set up a daily Vercel cron job that calls a sync API endpoint
- **Real-time:** Use Supabase webhooks to push changes (more complex, usually unnecessary)

## Env Vars Needed
```
MEILISEARCH_HOST=https://your-host-url
MEILISEARCH_API_KEY=your-api-key
```

Add to both `.env.local` and Vercel environment variables.

## NPM Package
```bash
npm install meilisearch
```

## Expected Performance
- Browse search: **<200ms** (Meilisearch ~50ms + network overhead)
- Faceted browse (Strategy + 2 players + rating > 7): **<200ms**
- Typo-tolerant search ("holow knght"): **<200ms**
- Current without Meilisearch: **2-10s** (after Phase 1 Postgres optimization)

## When to Set This Up
- If browse/search takes >5 seconds consistently after all Postgres optimizations
- If you add significantly more games (500k+)
- If you want typo-tolerant search (Postgres FTS doesn't handle typos)
- If you want instant faceted counts ("Strategy (2,451 games)")
