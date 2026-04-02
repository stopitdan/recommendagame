# Real User Eval Cases from BGG Forum Thread

Source: https://boardgamegeek.com/thread/3685387/

## Failure Cases (from real users)

### 1. Solo game returns multiplayer-only games
- **User:** @Kolmogorv
- **Query:** "thematic solo games" (board game type)
- **Problem:** Returned The Crew (min 2 players)
- **Expected:** Games that support solo play (1 player)
- **Failure type:** Hard constraint violation (player count)
- **Severity:** Critical -- player count is a dealbreaker

### 2. Hidden Gems returns popular/obvious games
- **User:** @black_daveth
- **Query:** Types of games they like, with Hidden Gems enabled
- **Problem:** "Easy/obvious results" -- same popular games as normal mode
- **Expected:** Obscure, out-of-print games rated 6.5 from 2005
- **Failure type:** Popularity bias not eliminated in hidden gems mode
- **Severity:** High -- defeats the purpose of the feature

### 3. "ALL" type defaults to board games only
- **User:** @plezercruz
- **Query:** Scenario clearly pointing to video game or party game, "ALL" type
- **Problem:** Only returned standard board games
- **Expected:** Video games or party games matching the scenario
- **Failure type:** Game type inference failure
- **Severity:** High -- user explicitly asked for all types

### 4. Designer search returns only 1 game
- **User:** @wtncffts
- **Query:** "A game designed by Stefan Feld"
- **Problem:** Only Castles of Burgundy appeared, no other Feld games
- **Expected:** Multiple Feld games (Trajan, Bora Bora, Bruges, Notre Dame, etc.)
- **Failure type:** Designer search too shallow
- **Severity:** High -- designer is a primary signal

### 5. Specific game description doesn't find the game
- **User:** @wtncffts
- **Query:** "worker placement game designed by Uwe Rosenberg where you play as cave dwelling farmers"
- **Problem:** Caverna didn't appear in results
- **Expected:** Caverna as #1 result (this describes Caverna exactly)
- **Failure type:** Free text + designer + mechanic combination failure
- **Severity:** Critical -- this is an exact description of a specific game

### 6. Time constraint massively violated
- **User:** @fortyfive
- **Query:** Convention, want something new, 90 minutes, 4 players
- **Results reported:**
  - Tzolk'in (at least 90 min) -- borderline fail
  - Brass: Birmingham (way over 90 min) -- FAIL
  - Pandemic Legacy: Season 1 (borderline)
  - The Crew: Mission Deep Sea (under 90 min) -- PASS
  - Quacks of Quedlinburg (under 90 min) -- PASS
  - Harmonies (under 90 min) -- PASS
  - Dune: Imperium (over 90 min) -- FAIL
  - Scythe (unlikely under 90 for first game) -- FAIL
  - Through the Ages (way over 90 min) -- FAIL
- **Expected:** All results should be playable in 90 minutes or less
- **Failure type:** Time constraint not properly enforced
- **Severity:** Critical -- 5 of 9 results violate the stated time

### 7. Text description completely ignored
- **User:** @stenole
- **Query:** Specific text description (unspecified)
- **Problem:** "Seems to ignore everything I put in the text description and give me a list of random popular games"
- **Expected:** Results reflecting the text description
- **Failure type:** Free text parsing/scoring not working; popularity dominates
- **Severity:** Critical -- core feature not working

### 8. Multiple constraint violations + broken text
- **User:** @stevage
- **Query:** "A very thematic euro-style game that takes about an hour, is quick to learn, and you could take to the pub" (board game, 3 players)
- **Problem:** Poker at #2 (not thematic, not euro, "best at 6 players")
- **Also:** Game description page showed tokenized/lemmatized gibberish instead of real description
- **Expected:** Thematic euros under 60 min, portable, 3-player friendly
- **Failure type:** Multiple constraint violations + description display bug
- **Severity:** Critical

## Success Cases (from real users)

### 1. Wavelength-like game query
- **User:** @black_daveth (quoting a BGG forum question)
- **Query:** "Any game recommendations for fans of Wavelength that are easy to learn and lead to fun conversations?"
- **Results:** Decrypto, The Resistance: Avalon, Deception: Murder in Hong Kong, Concept, Codenames, Captain Sonar
- **Verdict:** "Those results are actually a lot better than just suggesting a bunch of party games"
- **Why it worked:** Natural language comparison with specific game reference + mood/vibe

### 2. Video game with explicit type selection
- **User:** @plezercruz
- **Query:** Same scenario but clicked "video" type
- **Verdict:** "Gave me exactly what I was looking for. A+ result."
- **Why it worked:** Explicit type selection bypassed the inference problem

### 3. Chess description
- **User:** @wtncffts
- **Query:** Extremely detailed description of chess (8x8 board, pieces, checkmate)
- **Results:** Chess was listed first, but only 59% match
- **Verdict:** Found the game but match score seems wrong for an exact description
- **Why it partially worked:** Text search caught it; scoring formula gave low confidence

## User Suggestions

1. **Collection filtering** (@thorbot): Filter results to only games user owns
2. **Hidden gems needs to go deeper** (@black_daveth): Should surface obscure games from 2005 rated 6.5
3. **Remove ALL type or fix it** (@plezercruz): If it defaults to board games, don't offer ALL
4. **Example queries** (@stenole): Show users what kinds of queries work well
5. **Consider learning time** (@fortyfive via stopitdan response): A complex game that takes 60 min to learn doesn't fit a 90 min slot
6. **Test components individually** (@Kolmogorv): Validate each engine layer separately
