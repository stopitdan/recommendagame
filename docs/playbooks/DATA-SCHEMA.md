# Playbook: Defining or Extending a Data Schema

Use this when creating a new TypeScript type or extending an existing one.

---

## Principles

1. **Single source of truth** — All types live in `src/types/`. Never define inline types that should be shared.
2. **Explicit over implicit** — Prefer explicit union types over `string`. Use enums or const objects for known values.
3. **Optional means optional** — Only mark fields as optional (`?`) if they genuinely may not exist. Don't use optional as a shortcut for "I'll fill this in later."
4. **Document non-obvious fields** — Add JSDoc comments for fields whose purpose isn't clear from the name.

---

## Checklist

### Creating a New Type
- [ ] Create or update the appropriate file in `src/types/`
- [ ] Define the interface with all known fields
- [ ] Use union types for fields with known possible values
- [ ] Add JSDoc comments for non-obvious fields
- [ ] Export the type

### Extending an Existing Type
- [ ] Check all existing usages of the type (grep for the type name)
- [ ] Add the new field(s) — decide if optional or required
- [ ] Update all places that construct the type (adapters, factories, etc.)
- [ ] Update any validation or mapping logic

---

## Template

```typescript
// src/types/<name>.ts

/** Brief description of what this type represents */
export interface MyType {
  /** Unique identifier, prefixed with source (e.g., "bgg-12345") */
  id: string;

  name: string;

  /** Where this data came from */
  source: 'bgg' | 'rawg' | 'igdb' | 'local';

  /**
   * Complexity on a 1-5 scale.
   * 1 = very simple, 5 = very complex.
   */
  complexity?: number;
}
```

---

## Conventions

- **Naming:** PascalCase for interfaces/types, camelCase for fields
- **IDs:** Always prefix with source name to avoid collisions (e.g., `bgg-13`, `rawg-3498`)
- **Arrays:** Use `Type[]` not `Array<Type>`
- **Nullability:** Prefer `undefined` (optional field) over `null` unless `null` has semantic meaning (e.g., "explicitly unrated" vs "rating not fetched")
