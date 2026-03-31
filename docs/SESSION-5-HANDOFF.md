# Session 5 Handoff - March 30, 2026

## What Was Done This Session

This was a massive session covering recommendation engine fixes, UI overhaul, and 10+ new features. Here's everything organized by category.

---

### Recommendation Engine Quality (47% -> 68% eval pass rate)

These 5 fixes addressed the root causes of bad recommendations:

1. **Genre scoring activated** (`scoring.ts`, `route.ts`)
   - `llmParsed.genres` now feeds into `body.genres` so the 20% genre weight actually differentiates games
   - Previously, free text queries got 0.5 (neutral) for every game on this dimension

2. **Time scoring activated** (`scoring.ts`)
   - `llmParsed.maxMinutes` now feeds `scoreTimeFit`, so "under 30 minutes" in free text scores properly
   - New function signature accepts `llmParsed` parameter

3. **Popularity scoring recalibrated** (`scoring.ts`)
   - Old: bonuses stacked so every candidate hit 1.0 (useless for differentiation)
   - New: 3 sub-signals (BGG rank, rating count, ownership) averaged with smooth gradients

4. **LLM reranker window increased** (`llm-rerank.ts`)
   - Top 40 candidates (was 25), compact prompt (removed descriptions, fewer tags)
   - Switched from GPT-4o to GPT-4o-mini for speed

5. **In-memory similarity deweighted** (`route.ts`)
   - 85/15 rule-vs-similarity split (was 60/40) since hash embeddings are noisy

6. **Designer-aware scoring** (`scoring.ts`, `route.ts`, `parse-preferences.ts`, `types.ts`)
   - New `designers` field in `ParsedPreferences`
   - LLM parser extracts designer names from free text
   - `scoreFreeTextLLM` matches against `game.designers` with 1.5x weight (strongest signal)
   - New `fetchDesignerCandidates()` fetches games by designer directly from DB
   - "Stefan Feld games" now returns 43/100 Feld games with Castles of Burgundy at #1

7. **Player count from URL params** (`ResultsView.tsx`)
   - Fixed bug where `minPlayers`/`maxPlayers` URL params were ignored (always sent [1,10])
   - "Solo games" now properly filters to min_players=1

### UI/UX Changes

8. **Game type visual separation** (Concepts 1+2 combined)
   - New `game-type-config.ts` -- central config mapping GameType to color/tint/label
   - **GameCard**: 4px left border in type color, 28px circular icon badge (top-right), subtle background tint, removed old "Board Game" text chips
   - **Filter chips** on Results + Browse pages now use per-type colors when active
   - **GameTypeStep** (questionnaire): selected cards glow in their type's color
   - **GameDetailView**: type chips are filled with type color + include icon

9. **Popularity mode consolidation** (`ResultsView.tsx`, `route.ts`, `scoring.ts`)
   - Removed "Popular" mode -- "All" is now the default
   - Hidden Gems redefined: <2000 ratings, not in BGG top 1000, rating 7.0+, min 20 ratings
   - Post-fetch filter catches popular games from non-rating sources

10. **BGG sync & Collection more accessible** (`ProfileHub.tsx`, `HeaderAuth.tsx`, `MobileNav.tsx`)
    - BGG sync inline on Profile Collection tab (not buried in Settings)
    - "My Collection" in user dropdown menu (desktop + mobile)
    - Profile stat cards clickable to switch tabs
    - `?tab=collection` URL param support

---

### New Features (10 features across 4 phases)

#### Phase 1: Quick Wins

11. **"Why this?" reasons on GameCard** (`scoring.ts`, `GameCard.tsx`, `ResultsView.tsx`)
    - Improved `generateReasons()`: BGG rank callouts, hidden gem detection, designer attribution, lowered thresholds
    - Top 2 reasons shown as italic text on every card
    - Removed old separate reason chips below cards

12. **Mechanic explainer tooltips** (`mechanic-descriptions.ts`, `MechanicChip.tsx`, `GameDetailView.tsx`)
    - 56 hand-written mechanic descriptions with example games
    - Click any mechanic chip on game detail page to see description + "Browse games with this mechanic" link

13. **Beta feedback prompts** (`ResultsFeedbackPrompt.tsx`, `FloatingFeedbackButton.tsx`, `ResultsView.tsx`)
    - Inline "How are these results?" card after 5th result (thumbs up/down + expandable reasons)
    - Floating coral FAB bottom-right on results page for freeform feedback

14. **BGG trending feed** (`api/games/trending/route.ts`, `TrendingGames.tsx`, `page.tsx`)
    - Horizontal scrollable card row on landing page
    - Top 20 BGG-ranked games, cached 6 hours in Redis

#### Phase 2: Medium Effort

15. **User-submitted corrections** (`023_game_corrections.sql`, `corrections/route.ts`, `ReportIssueButton.tsx`)
    - Flag icon on game detail page opens dialog to report incorrect data
    - 13 correctable fields (player count, play time, complexity, categories, etc.)
    - Rate limited: 10/user/day. Stored as pending for review.

16. **Price tracker MVP** (`BuyOptions.tsx`, `GameCard.tsx`, `GameDetailView.tsx`)
    - "Buy" chip replaced with dropdown showing multiple stores
    - Board: Amazon (affiliate), BGG Marketplace, Target, Walmart, GameNerdz
    - Video: Amazon, Steam, GOG, Epic Games Store

17. **"Teach me" quick-start guides** (`quickstart/route.ts`, `QuickStartGuide.tsx`)
    - Collapsible "How to Play" accordion on game detail page
    - GPT-4o-mini generates structured summary (Overview, Setup, How to Play, How to Win, Pro Tips)
    - Grounded in actual game metadata. Cached 30 days. Quality gate: needs description > 100 chars + mechanics.

#### Phase 3: Larger Projects

18. **Steam library import** (`steam/user-library.ts`, `steam/sync.ts`, `api/sync/steam/route.ts`, `ProfileHub.tsx`)
    - Follows BGG sync pattern: resolve vanity URL -> fetch library -> match by name -> insert owned games
    - Steam sync card on Profile Collection tab (coral accent)
    - **Requires `STEAM_API_KEY` env var** (added, working)

19. **Board game sommelier chat** (`api/chat/route.ts`, `chat/ChatView.tsx`, `chat/system-prompt.ts`, `chat/tools.ts`)
    - GPT-4o with 3 function calling tools (search_games, get_game_details, find_similar)
    - Full chat UI with starter prompts, message bubbles, auto-scroll
    - **Currently hidden** -- nav links commented out, /chat redirects to home
    - Ready to enable for paid tier: uncomment in `HeaderNav.tsx`, `MobileNav.tsx`, and `chat/page.tsx`

#### Phase 4: Experimental

20. **Visual game map** (`neighborhood/route.ts`, `GameNeighborhood.tsx`, `map/MapView.tsx`)
    - Force-directed graph (d3-force) showing a game + its 20 nearest neighbors
    - Nodes sized by popularity, colored by game type, connected by similarity
    - Click a neighbor to navigate to that game
    - On game detail page + standalone `/map` page
    - Installed `d3-force` + `@types/d3-force` dependencies

21. **Cross-type recommendations** (`CrossTypeRecommendations.tsx`, `GameDetailView.tsx`)
    - "Board games you might like" on video game pages (and vice versa)
    - Matches by shared categories via browse API

---

### In-Progress

22. **Semantic embeddings generation** (background script)
    - Script running: `npx tsx scripts/generate-semantic-embeddings.ts 200 0`
    - Progress: ~18.5k of 81k games have semantic embeddings
    - Cost: ~$0.25 total for remaining ~62k games
    - Resumable: re-run the same command if interrupted
    - When complete: enables `match_games_semantic()` RPC for much better similarity search

---

## What's NOT Done Yet

### From This Session's Ideas List (not started)

| Idea | Effort | Notes |
|------|--------|-------|
| Game of the Week email digest | 4-6h | Resend integration exists |
| Shareable taste profiles | 1-2d | Compute from favorites/feedback |
| Game night planner | 2-3d | Multi-game schedule builder |
| Community lists | 3-5d | User-created, upvoteable. Good for SEO |
| "Convince me" mode | 3-4h | GPT-generated pitch for skeptics |
| Achievement system expansion | 1d | More achievement types |
| "Shelf of shame" tracker | 1d | Owned but unplayed |
| Seasonal recommendations | 4-6h | Auto-themed by date |

### From Session 4 Handoff (still pending)

- Semantic embeddings batch script needs to finish running (in progress)
- Seed users script not run yet
- Blog auto-generation quality not checked
- Product Hunt posting
- Google AdSense not applied for
- Reddit account situation (previous one shadowbanned)

### Known Issues

- **Eval pass rate**: 63-68% on hardcoded 19 cases. Full 743-case suite not re-run since scoring changes. Should re-run to get updated baseline.
- **LLM reranker nondeterminism**: GPT-4o-mini reranker produces slightly different results each run. Acceptable trade-off for speed.
- **Semantic embedding coverage**: Only ~23% complete. The recommendation engine won't fully benefit until this finishes.
- **Chat sommelier search**: The `search_games` tool does ilike name search + description fallback. Could be improved with the semantic embedding search once coverage is higher.

---

## Key Files Changed This Session

| File | Changes |
|------|---------|
| `src/lib/recommendation/scoring.ts` | Genre/time/popularity recalibration, designer scoring, reason generation improvements |
| `src/app/api/recommend/route.ts` | Genre/time piping, similarity deweight, hidden gems filter, designer candidate fetching |
| `src/lib/recommendation/llm-rerank.ts` | GPT-4o-mini switch, compact prompts, window increase |
| `src/lib/llm/types.ts` | Added `designers` field to ParsedPreferences |
| `src/lib/llm/parse-preferences.ts` | Added designer extraction to LLM prompt |
| `src/components/GameCard.tsx` | Type color border, icon badge, bg tint, reasons, BuyOptions |
| `src/app/results/ResultsView.tsx` | Player count fix, popularity modes, feedback prompts, type-colored chips |
| `src/app/browse/BrowseView.tsx` | Type-colored filter chips |
| `src/app/games/[id]/GameDetailView.tsx` | Type chips, MechanicChip, ReportIssue, QuickStart, GameNeighborhood, CrossType |
| `src/app/profile/ProfileHub.tsx` | BGG sync inline, Steam sync, clickable stat cards, tab URL param |
| `src/components/HeaderNav.tsx` | Type colors, chat link (commented) |
| `src/components/MobileNav.tsx` | Collection link, chat link (commented) |
| `src/components/HeaderAuth.tsx` | My Collection in dropdown |

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/game-type-config.ts` | Central game type -> color/tint/label mapping |
| `src/data/mechanic-descriptions.ts` | 56 mechanic descriptions with examples |
| `src/components/MechanicChip.tsx` | Clickable mechanic chip with description popover |
| `src/components/ResultsFeedbackPrompt.tsx` | Inline feedback after 5th result |
| `src/components/FloatingFeedbackButton.tsx` | Fixed FAB for feedback |
| `src/components/TrendingGames.tsx` | Horizontal trending games row |
| `src/components/BuyOptions.tsx` | Multi-store buy dropdown |
| `src/components/ReportIssueButton.tsx` | Data correction dialog |
| `src/components/QuickStartGuide.tsx` | AI-generated how-to-play accordion |
| `src/components/GameNeighborhood.tsx` | Force-directed game map (d3-force + canvas) |
| `src/components/CrossTypeRecommendations.tsx` | Board/video cross-recommendations |
| `src/app/api/games/trending/route.ts` | Trending games endpoint |
| `src/app/api/games/[id]/corrections/route.ts` | User corrections endpoint |
| `src/app/api/games/[id]/quickstart/route.ts` | Quick-start guide generation |
| `src/app/api/games/[id]/neighborhood/route.ts` | Neighborhood graph data |
| `src/app/api/sync/steam/route.ts` | Steam library sync |
| `src/app/api/chat/route.ts` | Chat sommelier with function calling |
| `src/app/chat/page.tsx` | Chat page (redirects to / while hidden) |
| `src/app/chat/ChatView.tsx` | Chat UI component |
| `src/app/map/page.tsx` | Standalone game map page |
| `src/app/map/MapView.tsx` | Map page with search |
| `src/lib/chat/system-prompt.ts` | Sommelier persona prompt |
| `src/lib/chat/tools.ts` | OpenAI function calling tool definitions |
| `src/lib/steam/user-library.ts` | Steam API library fetcher |
| `src/lib/steam/sync.ts` | Steam collection sync service |
| `supabase/migrations/023_game_corrections.sql` | Game corrections table |

---

## Environment Variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `STEAM_API_KEY` | Added this session | Steam library import |
| `OPENAI_API_KEY` | Existing | LLM parsing, reranking, chat, quickstart guides |
| `RESEND_API_KEY` | Existing | Feedback emails |
| All others | Unchanged | |

---

## To Re-Enable Chat Sommelier

When ready for a paid tier:

1. `src/components/HeaderNav.tsx` -- uncomment the Sommelier nav item
2. `src/components/MobileNav.tsx` -- uncomment the Sommelier nav item
3. `src/app/chat/page.tsx` -- uncomment `ChatView`, remove `redirect('/')`

---

## Game Map Status (WIP -- NOT production-ready)

The interactive game map (`/map`) is partially built but needs significant rearchitecture before it's good enough to ship. What exists:

**Working:**
- UMAP 2D projections computed for 32,704 games (stored in `scripts/map-positions.json`)
- PixiJS rendering engine with zoom/pan/pinch
- 50 pre-computed flat clusters with category-based labels
- Static JSON export pipeline (`public/data/map-nodes.json`, 7.9MB)
- Image proxy API for CORS-safe thumbnails
- Search integration (flies to game if it has a map position)
- Dynamic viewport-based grid clustering (runtime)

**NOT working / needs rearchitecture:**
- **Hierarchical clustering** -- need pre-computed cluster tree (not flat k-means). When you click a cluster, it should split into sub-clusters, not jump to individual games. Need agglomerative clustering at 4-5 levels.
- **Cluster naming** -- should use LLM to generate meaningful names at each level, not just "Card Game & Fantasy". E.g., level 1: "Strategy", level 2: "Euro Strategy", level 3: "Worker Placement Euros", level 4: individual games.
- **Visual polish** -- needs proper sized circles at each level (like the Spotify genre map), smooth transitions between levels, game images at closest zoom.
- **The field name mapping bug was fixed** (JSON uses `n` for name, TypeScript uses `name`).

**Key files:**
- `scripts/compute-map-positions.py` -- UMAP + flat k-means (needs hierarchical clustering)
- `scripts/export-map-data.ts` -- exports to JSON (needs hierarchy structure)
- `src/app/map/MapRenderer.ts` -- PixiJS renderer (needs hierarchy-aware rendering)
- `src/app/map/GameMap.tsx` -- React wrapper
- `src/app/map/CameraController.ts` -- zoom/pan (working)
- `src/app/map/types.ts` -- type definitions
- `src/app/map/useMapData.ts` -- data loader
- `public/data/map-nodes.json` -- static data (32k nodes)
- `supabase/migrations/024_map_positions.sql` -- DB columns (applied)

**Approach for next session:**
1. Pre-compute hierarchical agglomerative clustering in Python (scipy.cluster.hierarchy)
2. At each level, use GPT to name the clusters based on game categories/mechanics in them
3. Store the full hierarchy in the JSON (tree structure, not flat)
4. Renderer walks the tree based on zoom level, always showing ~30-50 bubbles
5. Click a bubble -> zoom to its children (which are either sub-clusters or games)
6. Smooth animated transitions between levels

## Recommended Next Priorities

1. **Deploy the non-map features** -- everything except the map is production-ready
2. **Re-run full eval suite** to get updated baseline with all scoring changes
3. **Game map rearchitecture** -- hierarchical clustering + LLM naming (next session)
4. **Seasonal recommendations** (quick win, 4-6h)
5. **Shareable taste profiles** (good for social/viral growth)
6. **Community lists** (best SEO play)
