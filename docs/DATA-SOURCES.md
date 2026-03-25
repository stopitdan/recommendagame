# Data Sources

API research, endpoints, authentication, and rate limits for all game data sources.

---

## BoardGameGeek (BGG) XML API2

| Field | Value |
|-------|-------|
| Type | Board games |
| Base URL | `https://boardgamegeek.com/xmlapi2/` |
| Auth | None required |
| Format | XML |
| Rate Limit | ~1 request per 5 seconds |
| Docs | https://boardgamegeek.com/wiki/page/BGG_XML_API2 |

### Key Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/search?query=catan&type=boardgame` | Search games by name | Returns list of matches with IDs |
| `/thing?id=13,34&stats=1` | Get game details (supports multiple IDs) | Full game info with ratings |
| `/hot?type=boardgame` | Currently trending games | Top 50 hot games |
| `/collection?username=X` | User's collection | All games a BGG user owns |

### Useful Data Fields
- Name, description, year published
- Min/max players, suggested player count (via poll)
- Playing time (min/max/average)
- Complexity weight (1-5 scale)
- Categories and mechanics
- Average rating, number of ratings
- Thumbnail and image URLs

### Gotchas (confirmed during implementation)
- Returns HTTP 202 if data isn't ready yet — adapter retries up to 3 times with 2s delay
- XML parsing required — using `fast-xml-parser` with `isArray` config for consistent handling
- Large batch requests may time out — we batch /thing IDs in groups of 20
- Some endpoints are slow (2-5 seconds)
- Must send a `User-Agent` header or BGG may return "Unauthorized"
- Search returns only IDs + names — full details require a follow-up /thing call
- XML fields can be single objects or arrays depending on result count — `ensureArray()` helper normalizes this
- `suggested_numplayers` poll requires parsing nested voting data to find "Best" player count
- Descriptions contain HTML entities and tags (`&amp;`, `&#10;`, `<br/>`) — must strip before storing

---

## RAWG Video Games Database

| Field | Value |
|-------|-------|
| Type | Video games |
| Base URL | `https://api.rawg.io/api/` |
| Auth | API key as query param (`?key=YOUR_KEY`) |
| Format | JSON |
| Rate Limit | Not explicitly documented; be reasonable |
| Docs | https://rawg.io/apidocs |
| Signup | https://rawg.io/login?forward=developer |

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/games?search=zelda&key=X` | Search games |
| `/games/{id}?key=X` | Game details |
| `/games/{id}/screenshots?key=X` | Game screenshots |
| `/genres?key=X` | List all genres |
| `/platforms?key=X` | List all platforms |
| `/tags?key=X` | List all tags |

### Useful Data Fields
- Name, description (HTML in list, `description_raw` in detail), release date
- Platforms (PC, PlayStation, Xbox, Nintendo, etc.) — nested structure with parent_platforms
- Genres and tags (tags include themes like "Sci-fi", "Fantasy" + mechanics-like "Co-op", "Multiplayer")
- Rating (0-5 scale — we normalize to 0-10 by multiplying by 2)
- Metacritic score
- ESRB rating
- Screenshots and background images
- Playtime estimate in hours (we convert to minutes)
- Stores (where to buy)
- Developers and publishers (detail endpoint only)

### Gotchas (confirmed during implementation)
- List endpoint (`/games`) returns rich data — no need for follow-up detail call for basic info
- Detail endpoint (`/games/{id}`) adds `description_raw` (plain text) and `description` (HTML)
- Rating is 0-5 scale, not 0-10 — must normalize
- Playtime is in hours, not minutes
- Tags are a mix of themes and mechanics — filter by `language: "eng"` to avoid duplicates
- `parent_platforms` gives cleaner groupings than `platforms` (e.g. "PC" vs "Windows"/"Linux" separately)
- No player count data available — this field stays empty for video games
- No complexity metric — unlike BGG's weight system
- `search_precise: true` reduces fuzzy matches for better relevance

---

## IGDB (Internet Game Database)

| Field | Value |
|-------|-------|
| Type | Video games |
| Base URL | `https://api.igdb.com/v4/` |
| Auth | Twitch OAuth (Client ID + Bearer token) |
| Format | JSON (Apicalypse query language) |
| Rate Limit | 4 requests/second |
| Docs | https://api-docs.igdb.com/ |

### Notes
- Richer metadata than RAWG (franchises, characters, age ratings)
- Requires Twitch developer account for auth
- Uses a custom query language (Apicalypse) instead of REST params
- Good as a secondary/enrichment source

---

## Word Games

| Field | Value |
|-------|-------|
| Type | Digital word games (Wordle, Connections, Spelling Bee, etc.) |
| Source | Curated local JSON dataset (`src/data/word-games.json`) |
| Auth | None (local data) |
| Format | JSON |
| Rate Limit | None |

### Decision (confirmed during implementation)
**Two-layer approach:**
1. **Physical/tabletop word games** — Already covered by BGG. The "Word Game" category (ID 1025) contains 700+ games including Scrabble, Codenames, Bananagrams, Boggle, etc.
2. **Digital word games** — Curated local dataset of ~20 notable titles. No word game API exists (researched thoroughly). The digital word game universe is small and changes slowly, making manual curation practical and higher quality than any automated source.

### What's in the dataset
- NYT Games: Wordle, Spelling Bee, Connections, Strands, Letterboxed
- Wordle variants: Quordle, Octordle, Dordle, Nerdle, Crosswordle
- Mobile: Words With Friends 2, Wordscapes, Scrabble GO, Word Cookies, Ruzzle
- Other: Contexto, SpellTower, TypeShift, Bonza, Babble Royale

### What's NOT in the dataset (covered by BGG instead)
- Scrabble (board game), Codenames, Bananagrams, Boggle, Just One, Letter Jam, Decrypto, Paperback, etc.

---

## API Key Management

All API keys should be stored in environment variables, never committed to the repo.

```env
# .env.local (do not commit)
RAWG_API_KEY=your_key_here
IGDB_CLIENT_ID=your_client_id
IGDB_CLIENT_SECRET=your_secret
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SYNC_SECRET=your_sync_secret
```
