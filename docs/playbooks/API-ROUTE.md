# Playbook: Adding a New API Route

Use this when creating a new backend endpoint in Next.js.

---

## Checklist

- [ ] Create `src/app/api/<path>/route.ts`
- [ ] Export named functions for each HTTP method (`GET`, `POST`, etc.)
- [ ] Validate input (query params, request body)
- [ ] Return proper status codes and JSON responses
- [ ] Handle errors gracefully — never expose internal errors to the client
- [ ] Add rate limiting if the route calls external APIs
- [ ] Test the endpoint manually or with automated tests

---

## Template

```typescript
// src/app/api/games/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Missing required parameter: q' },
      { status: 400 }
    );
  }

  try {
    // Call adapters / services
    const results = await searchGames(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[API] /games/search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Conventions

- **File location:** `src/app/api/<resource>/<action>/route.ts`
- **HTTP methods:** Use `GET` for reads, `POST` for writes/complex queries
- **Response format:** Always return JSON with consistent shape (`{ data }` or `{ error }`)
- **Status codes:** 200 success, 400 bad request, 401 unauthorized, 404 not found, 500 server error
- **Auth:** Check Firebase token in `Authorization` header for protected routes
- **No side effects in GET:** GET routes should be safe and idempotent
