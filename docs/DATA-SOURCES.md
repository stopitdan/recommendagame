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

### Gotchas
- Returns HTTP 202 if data isn't ready yet — need to retry after a delay
- XML parsing required
- Large batch requests may time out — batch IDs in groups of ~20
- Some endpoints are slow (2-5 seconds)

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
- Name, description, release date
- Platforms (PC, PlayStation, Xbox, Nintendo, etc.)
- Genres and tags
- Metacritic score
- ESRB rating
- Screenshots and background images
- Playtime estimate (average from users)
- Stores (where to buy)

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

No single authoritative API exists. Planned approach:

### Option A: Curated Local Dataset
Maintain a JSON/SQLite file of popular word games with manually curated metadata. Many word games are also board games that appear on BGG (Scrabble, Codenames, Bananagrams, etc.).

### Option B: Supplement with APIs
- **Free Dictionary API** (`https://dictionaryapi.dev/`) — word definitions, no auth
- **Wordnik** (`https://developer.wordnik.com/`) — extensive word data, free tier
- **Word Game Dictionary API** — Scrabble word validation (100 calls/24h free)

### Decision
TBD — likely Option A (curated dataset) supplemented by BGG data for board-game word games. Pure digital word games (Wordle clones, etc.) may need manual curation.

---

## API Key Management

All API keys should be stored in environment variables, never committed to the repo.

```env
# .env.local (do not commit)
RAWG_API_KEY=your_key_here
IGDB_CLIENT_ID=your_client_id
IGDB_CLIENT_SECRET=your_secret
FIREBASE_API_KEY=your_key
FIREBASE_PROJECT_ID=your_project_id
# ... etc
```
