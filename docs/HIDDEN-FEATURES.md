# Hidden Features

Features that are fully built but hidden from navigation/UI pending further testing and polish. All routes still work directly -- they just aren't linked anywhere.

## Game Map (`/map`)

**Status:** Functional, needs UI polish
**Hidden from:** HeaderNav, MobileNav
**What works:** Hierarchical circle-packed cluster visualization of 32k games, drill-down navigation, search, breadcrumbs
**What needs work:** Circle sizing at deeper levels, label readability when zoomed, mobile touch UX
**To re-enable:**
- `src/components/HeaderNav.tsx` -- uncomment Game Map nav item
- `src/components/MobileNav.tsx` -- uncomment Game Map nav item

## Board Game Sommelier Chat (`/chat`)

**Status:** Functional, intended for paid tier
**Hidden from:** HeaderNav, MobileNav (route is accessible, no redirect)
**What works:** GPT-4o chat with function calling tools (search_games, get_game_details, find_similar), full chat UI with starter prompts
**To re-enable:**
- `src/components/HeaderNav.tsx` -- uncomment Sommelier nav item
- `src/components/MobileNav.tsx` -- uncomment Sommelier nav item

## Game Neighborhood (game detail page)

**Status:** Functional, hidden until map is polished
**Hidden from:** Game detail page (`/games/[id]`)
**What works:** Force-directed d3 graph showing a game + 20 nearest neighbors, click to navigate
**To re-enable:**
- `src/app/games/[id]/GameDetailView.tsx` -- uncomment the Game Neighborhood section (search for "hidden until map rearchitecture")
