# Playbook: Hooking Up a New API / Data Source

Use this whenever we add a new external game data source.

---

## Checklist

### 1. Research the API
- [ ] Document in `docs/DATA-SOURCES.md`: base URL, auth method, rate limits, response format
- [ ] Identify the key endpoints we need (search, detail, list)
- [ ] Note any gotchas (XML vs JSON, pagination, retries, 202 responses, etc.)
- [ ] Get API key if needed, add to `.env.local`

### 2. Create the Adapter
- [ ] Create `src/lib/adapters/<source-name>.ts`
- [ ] Implement the `GameAdapter` interface:

```typescript
interface GameAdapter {
  search(query: string, options?: SearchOptions): Promise<Game[]>;
  getById(id: string): Promise<Game | null>;
  getPopular?(limit?: number): Promise<Game[]>;
}
```

### 3. Map to Unified Schema
- [ ] Map every relevant field from the API response to our `Game` type
- [ ] Set `source` field to identify where the data came from
- [ ] Handle missing/optional fields gracefully (defaults, nulls)
- [ ] Normalize ratings to a consistent scale (e.g., 0-10)

### 4. Handle Rate Limiting
- [ ] Implement request throttling if the API has rate limits
- [ ] Use the cache layer — check cache before making API calls
- [ ] Handle rate limit errors gracefully (429, 503, etc.)

### 5. Error Handling
- [ ] Wrap API calls in try/catch
- [ ] Return empty results on failure, don't crash
- [ ] Log errors for debugging
- [ ] Handle network timeouts

### 6. Register the Adapter
- [ ] Add the adapter to the unified search service (`src/lib/search.ts` or similar)
- [ ] Ensure results are merged and deduplicated with other sources

### 7. Test
- [ ] Unit test the response mapping (mock API responses)
- [ ] Integration test with the real API (can be manual or a separate test suite)
- [ ] Verify the adapter works through the unified search endpoint

### 8. Update Docs
- [ ] Add tasks to `docs/TASKS.md`
- [ ] Update `docs/DATA-SOURCES.md` with any new findings
- [ ] Mark tasks complete as you go

---

## Template: Adapter File

```typescript
// src/lib/adapters/<source>.ts

import { Game } from '@/types/game';

const BASE_URL = 'https://api.example.com';

export async function search(query: string): Promise<Game[]> {
  const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    console.error(`[<source>] Search failed: ${response.status}`);
    return [];
  }
  const data = await response.json();
  return data.results.map(mapToGame);
}

export async function getById(id: string): Promise<Game | null> {
  const response = await fetch(`${BASE_URL}/games/${id}`);
  if (!response.ok) return null;
  const data = await response.json();
  return mapToGame(data);
}

function mapToGame(raw: any): Game {
  return {
    id: `<source>-${raw.id}`,
    source: '<source>',
    sourceId: String(raw.id),
    name: raw.name,
    description: raw.description ?? '',
    // ... map remaining fields
  };
}
```
