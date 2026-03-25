# Playbook: Working with Supabase

Guidelines for database operations, migrations, and client usage.

---

## Client Usage

### Server-Side (API routes, Server Components, server actions)
```typescript
import { createClient } from '@/lib/supabase/server';

// ALWAYS create inside the handler, never at module scope
const supabase = await createClient();

// ALWAYS use getUser() for auth checks — never getSession()
const { data: { user } } = await supabase.auth.getUser();
```

### Client-Side (Client Components with 'use client')
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
```

### Service Role (admin/cron jobs only)
```typescript
import { createServiceClient } from '@/lib/supabase/server';

// Bypasses RLS — use only for system operations
const supabase = createServiceClient();
```

---

## Writing Migrations

### Checklist
- [ ] Create a new file in `supabase/migrations/` with incrementing prefix
- [ ] Use `create table if not exists` for safety
- [ ] Always enable RLS on new tables
- [ ] Create appropriate RLS policies
- [ ] Add indexes for columns used in WHERE/ORDER BY
- [ ] Update `src/types/supabase.ts` to match the new schema
- [ ] Test the migration in the Supabase SQL Editor before committing

### Naming Convention
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_game_tags.sql
supabase/migrations/003_user_settings.sql
```

---

## Querying Games

### Insert from adapter
```typescript
import { gameToInsert } from '@/lib/supabase/games';
import { createServiceClient } from '@/lib/supabase/server';

const supabase = createServiceClient();
const insert = gameToInsert(game);

const { error } = await supabase
  .from('games')
  .upsert(insert, { onConflict: 'source,source_id' });
```

### Full-text search
```typescript
const { data } = await supabase
  .rpc('search_games_by_name', {
    search_query: 'catan',
    result_limit: 20,
  });
```

### Vector similarity search
```typescript
const { data } = await supabase
  .rpc('match_games', {
    query_embedding: userVector,  // number[768]
    match_count: 10,
    similarity_threshold: 0.5,
  });
```

---

## Key Rules

1. **Never cache Supabase clients at module level** — create per-request
2. **Never use `getSession()` on the server** — use `getUser()` (validates JWT)
3. **Never expose the service role key to the browser**
4. **Always enable RLS** on every table
5. **Use `upsert` with `onConflict`** when syncing external data to avoid duplicates
6. **Keep `src/types/supabase.ts` in sync** with migrations (or generate with `supabase gen types`)
