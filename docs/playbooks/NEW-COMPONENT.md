# Playbook: Creating a New UI Component

Use this when building a reusable React component.

---

## Checklist

- [ ] Create `src/components/<ComponentName>.tsx`
- [ ] Define props interface (exported, named `<ComponentName>Props`)
- [ ] Use MUI components and `sx` prop for styling (not raw CSS)
- [ ] Add `'use client'` directive only if the component uses hooks, event handlers, or browser APIs
- [ ] Keep components focused — one responsibility per component
- [ ] Consider loading/empty/error states

---

## Template

```typescript
// src/components/GameCard.tsx
'use client';

import { Card, CardContent, Typography } from '@mui/material';
import { Game } from '@/types/game';

export interface GameCardProps {
  game: Game;
  onClick?: (game: Game) => void;
}

export default function GameCard({ game, onClick }: GameCardProps) {
  return (
    <Card
      sx={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(game)}
    >
      <CardContent>
        <Typography variant="h6">{game.name}</Typography>
      </CardContent>
    </Card>
  );
}
```

---

## Conventions

- **File naming:** PascalCase matching the component name
- **Styling:** MUI `sx` prop. No separate CSS files, no Tailwind.
- **Props:** Always define an explicit props interface, exported for reuse
- **Default export:** One component per file, use default export
- **Server vs Client:** Default to server component. Only add `'use client'` when you need interactivity.
