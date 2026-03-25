# Playbook: Adding a New Page

Use this when creating a new route/page in the Next.js app.

---

## Checklist

- [ ] Create the route directory: `src/app/<route>/page.tsx`
- [ ] Add metadata export (title, description) for SEO
- [ ] Use server components by default; add `'use client'` only if needed
- [ ] Add to navigation (header/sidebar) if it's a user-facing page
- [ ] Ensure the page is responsive (test at mobile and desktop widths)
- [ ] Add loading state if the page fetches data (`loading.tsx`)
- [ ] Add error boundary if appropriate (`error.tsx`)

---

## Template

```typescript
// src/app/<route>/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Title | Recommend a Game',
  description: 'Brief description for SEO',
};

export default function PageName() {
  return (
    <main>
      {/* Page content */}
    </main>
  );
}
```

---

## Notes

- Check `node_modules/next/dist/docs/` for the latest Next.js 16 conventions before writing page code — APIs may differ from what you expect.
- Pages that need auth should check session state and redirect if needed.
- Dynamic routes use `[param]` folder naming (e.g., `src/app/games/[id]/page.tsx`).
