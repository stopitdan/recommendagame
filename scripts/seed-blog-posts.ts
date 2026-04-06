/**
 * Seed Blog Posts
 *
 * Inserts 15 high-quality, fact-checked blog posts into the blog_posts table.
 * These target real high-volume search queries and contain accurate game data.
 *
 * Usage:
 *   npx tsx scripts/seed-blog-posts.ts
 *
 * Cleanup:
 *   npx tsx scripts/seed-blog-posts.ts --cleanup
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Prefix so we can identify and clean up seeded posts
const SEED_SLUG_PREFIX = 'seed-';

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  featured_game_ids: string[];
  published_at: string;
  status: 'published';
}

interface GameInfo {
  id: string;
  name: string;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// Helper: look up game IDs + images from the DB so internal links work
// ---------------------------------------------------------------------------
async function findGame(name: string): Promise<GameInfo | null> {
  const { data } = await supabase
    .from('games')
    .select('id, name, image_url')
    .ilike('name', name)
    .limit(1)
    .single();
  return data ? { id: data.id, name: data.name, image_url: data.image_url } : null;
}

// ---------------------------------------------------------------------------
// All 15 blog posts
// ---------------------------------------------------------------------------
const POSTS: BlogPost[] = [

// ═══════════════════════════════════════════════════════════════════════════
// POST 1: Best Board Games for Couples
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-board-games-for-couples-2026',
  title: 'Best Board Games for Couples in 2026',
  description: 'The best 2-player board games for couples, from cozy co-ops to competitive duels. Find your next date night game.',
  tags: ['2-player', 'couples', 'date night', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-01T12:00:00Z',
  status: 'published',
  content: `Board games are one of the best date night activities that don't involve staring at a screen. The right game creates real moments of connection, laughter, and (healthy) competition. But picking the wrong one can torpedo the vibe faster than a bad restaurant choice.

Here are the best board games for couples, tested across every relationship dynamic from "we just started dating" to "we've been married for fifteen years and need something new on Tuesdays."

## Best Overall: Patchwork

Patchwork is a two-player-only game where you're both building quilts from shared Tetris-like patches. It sounds cozy because it is. But underneath the fabric theme is a tight economic puzzle where every button (the game's currency) matters.

Designed by Uwe Rosenberg (yes, the same person behind Agricola and Caverna) and released in 2014, Patchwork plays in about 15-30 minutes. The rules fit on one page. And yet you'll find yourself agonizing over which patch to grab, knowing your partner is eyeing the same one. It's competitive without being mean, strategic without being exhausting. BGG complexity: 1.6/5.

[Check price on Amazon](https://www.amazon.com/s?k=Patchwork+board+game&tag=boredgame-20)

## Best Cooperative: Sky Team

Sky Team won the 2024 Spiel des Jahres (the most prestigious award in board gaming), and it earned it. You play as a pilot and co-pilot trying to land a plane. The catch: you can't tell each other what dice you rolled.

This creates genuinely tense moments where you're both silently hoping the other person does the right thing. It's a communication puzzle wrapped in a theme that actually makes sense. Each landing scenario changes the difficulty, so you'll get dozens of plays before it feels repetitive.

[Check price on Amazon](https://www.amazon.com/s?k=Sky+Team+board+game&tag=boredgame-20)

## Best for Competitive Couples: 7 Wonders Duel

If you and your partner enjoy going head-to-head, 7 Wonders Duel is the gold standard. You're building ancient civilizations by drafting cards from a shared display, and there are three different ways to win: military dominance, scientific supremacy, or the most points.

What makes it special is the drafting. Every card you take is a card your opponent doesn't get. You're constantly weighing what helps you versus what hurts them. Games run 30 minutes and the back-and-forth tension is perfect.

[Check price on Amazon](https://www.amazon.com/s?k=7+Wonders+Duel+board+game&tag=boredgame-20)

## Best Quick Game: Lost Cities

Lost Cities has been a couples staple since 1999, and for good reason. You're playing cards to fund expeditions, but starting an expedition costs points if you can't commit enough cards to it. It's a game of calculated risk in 20 minutes.

Designed by Reiner Knizia and in print since 1999, the rules take two minutes to learn. Games run about 30 minutes. The decisions are agonizing every single time. "Do I start a new expedition or wait for better cards?" is a question that never gets old.

[Check price on Amazon](https://www.amazon.com/s?k=Lost+Cities+board+game&tag=boredgame-20)

## Best Abstract: Hive

Hive plays like chess but better in almost every practical way. There's no board, just hexagonal insect tiles that you place and move on any flat surface. Each bug type moves differently (the spider crawls exactly three spaces, the beetle climbs on top of other pieces, the ant slides anywhere along the outside edge).

Designed by John Yianni in 2001, games take 10-20 minutes in practice (the box says 20, experienced players are faster). The Pocket edition fits in a bag. You can play it at a coffee shop, a bar, or a park bench. It's become one of the most popular travel games for couples for a reason.

[Check price on Amazon](https://www.amazon.com/s?k=Hive+Pocket+board+game&tag=boredgame-20)

## Best for New Couples: Codenames Duet

If you're still in the "getting to know you" phase, Codenames Duet is perfect. You're both working together to guess words on a grid using one-word clues. The fun comes from discovering how your partner's brain makes connections.

"Why did you think 'ocean' connected to 'dog'?" leads to conversations you wouldn't have otherwise. It's cooperative, so there's no winner/loser tension, and the spy theme keeps it light.

[Check price on Amazon](https://www.amazon.com/s?k=Codenames+Duet+board+game&tag=boredgame-20)

## Best for a Longer Evening: Jaipur

Jaipur is a trading game set in an Indian market where you're competing to become the Maharaja's personal trader. You collect and sell goods, balancing the risk of hoarding cards for bigger bonuses against your opponent snatching them first.

A full game (best of three rounds) takes about 30 minutes. The first round teaches you the game, the second round you develop a strategy, and the third round is a knife fight. Designed by Sebastien Pauchon and released in 2009, Jaipur has won multiple awards and holds up perfectly after hundreds of plays.

[Check price on Amazon](https://www.amazon.com/s?k=Jaipur+board+game&tag=boredgame-20)

## How to Pick the Right One

A few things to consider:

- **If you hate losing**: Pick a co-op (Sky Team, Codenames Duet)
- **If you love trash talk**: Pick a competitive game (7 Wonders Duel, Hive)
- **If you want something chill**: Patchwork or Lost Cities
- **If you're short on time**: Hive or Lost Cities (under 20 minutes)
- **If you want something portable**: Hive Pocket or Jaipur

The best couples game is the one you'll actually pull off the shelf on a Tuesday night. Start simple, play often, and work your way up from there.

Want personalized recommendations based on what you both enjoy? [Try our game finder](/find-a-game) and tell it what you're looking for.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 2: Best Quick Board Games Under 30 Minutes
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-board-games-under-30-minutes',
  title: 'Best Board Games You Can Play in Under 30 Minutes',
  description: 'Quick board games that pack real decisions into 30 minutes or less. Perfect fillers for game night or weeknight play.',
  tags: ['quick games', 'filler', 'under 30 minutes', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-02T12:00:00Z',
  status: 'published',
  content: `Not every game night calls for a three-hour epic. Sometimes you have 30 minutes before dinner, a friend is about to leave, or you just want something quick between bigger games. These short board games prove that less time doesn't mean less fun.

Every game on this list plays in 30 minutes or less with experienced players. Most of them play faster than that.

## SCOUT

SCOUT is a card game where you can't rearrange your hand. You have to play cards in the order you were dealt them, which means every decision is about making the best of what you've got. You can play sets or runs to beat the current card combo on the table, or "scout" a card from the active set into your hand.

It plays 3-5 players in about 15 minutes. The dual-indexed cards (each card has a different number on each end) mean the same hand plays completely differently depending on which way you pick it up. Nominated for the 2022 Spiel des Jahres.

[Check price on Amazon](https://www.amazon.com/s?k=SCOUT+card+game&tag=boredgame-20)

## The Crew: Mission Deep Sea

A trick-taking game where you're cooperating instead of competing. Each round, players get assigned specific tricks they need to win, and you have to coordinate without talking about your hands. The campaign has 32 missions with escalating difficulty.

Plays 3-5 players (with a 2-player variant) in about 20 minutes per mission. The sequel to the original The Crew, Mission Deep Sea added a log system that makes communication rules more flexible. If your group likes card games at all, this is essential.

[Check price on Amazon](https://www.amazon.com/s?k=The+Crew+Mission+Deep+Sea+card+game&tag=boredgame-20)

## Cascadia

Place tiles and populate them with wildlife. Each turn you pick a habitat tile and an animal token from a shared market. Animals score based on specific patterns (bears want to be alone, salmon want to form runs, hawks need space from other hawks).

Cascadia won the 2022 Spiel des Jahres and plays 1-4 in about 30 minutes. The spatial puzzle is satisfying without being stressful, and the randomized scoring cards mean the optimal strategy changes every game. Works at every player count, including solo.

[Check price on Amazon](https://www.amazon.com/s?k=Cascadia+board+game&tag=boredgame-20)

## Love Letter

The entire game is 21 cards. On your turn, you draw a card and play a card. That's it. But each card has a different ability (the Guard lets you guess another player's card, the Princess makes you lose if you discard her, the Handmaid protects you for a round).

Plays 2-6 in about 10 minutes. It's the perfect game for when you're waiting for pizza, killing time before someone arrives, or just want a quick palate cleanser. Dozens of rethemed versions exist, but the original holds up.

[Check price on Amazon](https://www.amazon.com/s?k=Love+Letter+card+game&tag=boredgame-20)

## Coup

Five role cards, one table of liars. Everyone starts with two face-down character cards that give them special abilities. The twist: you can claim to be anyone. Say you're the Duke and collect tax money. Say you're the Assassin and take someone out. But if someone calls your bluff and you're lying, you lose a card.

Plays 2-6 in about 15 minutes. Coup is pure social deduction distilled to its simplest form. The meta evolves every game as your group develops reputations. "You always lie about the Contessa" becomes a running joke that lasts years.

[Check price on Amazon](https://www.amazon.com/s?k=Coup+card+game&tag=boredgame-20)

## Sea Salt & Paper

An underrated gem that dropped in 2022. You're collecting ocean-themed cards to build sets and combos. The clever part is the ending: when you think you're ahead, you can call "stop" and either end immediately or let everyone take one more turn for the chance at bonus points. That risk/reward decision at the end is what elevates it.

Plays 2-4 in about 20 minutes. The origami-style art is gorgeous, and the card combos are satisfying without being complicated. A perfect weeknight game.

[Check price on Amazon](https://www.amazon.com/s?k=Sea+Salt+and+Paper+card+game&tag=boredgame-20)

## For Sale

The best auction game at any length, and it plays in 15 minutes. Round one: bid on properties (numbers 1-30). Round two: simultaneously sell your properties for checks. Highest total wins.

The first half teaches you that overbidding kills you. The second half teaches you that holding your best cards too long is just as bad. For Sale works with 3-6 players and is the perfect opener for any game night.

[Check price on Amazon](https://www.amazon.com/s?k=For+Sale+board+game&tag=boredgame-20)

## What Makes a Great Quick Game

The best short games share a few traits:

- **Teach time under 3 minutes**: If it takes longer to explain than to play, it's not a filler
- **Meaningful decisions**: Rolling dice and moving isn't a game, it's waiting
- **Replayability**: You'll play these dozens of times, so they need to stay fresh
- **Portable**: Most of these fit in a coat pocket

Looking for quick games that match your group's taste? [Try our game finder](/find-a-game) and filter by play time.

[Browse all quick games](/browse?maxPlayTime=30)`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 3: Games Like Gloomhaven But Shorter
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-games-like-gloomhaven-but-shorter',
  title: 'Games Like Gloomhaven That Won\'t Take Over Your Life',
  description: 'Love dungeon crawling but short on time? These Gloomhaven alternatives deliver the same tactical combat in half the time.',
  tags: ['dungeon crawl', 'gloomhaven', 'cooperative', 'alternatives'],
  featured_game_ids: [],
  published_at: '2026-04-03T12:00:00Z',
  status: 'published',
  content: `Gloomhaven is a masterpiece. It's also a 100+ hour commitment that weighs about 21 pounds and takes 30 minutes just to set up. If you love tactical dungeon crawling but don't want to dedicate half your free time to a single campaign, these alternatives deliver the same core thrill in much less time.

## Gloomhaven: Jaws of the Lion

The obvious starting point. Jaws of the Lion is a standalone Gloomhaven experience designed specifically for people who found the original intimidating. It uses the same card-driven combat system but trims the fat.

The game teaches itself through a brilliant five-scenario tutorial where each mission adds one new rule. No separate rulebook needed for your first session. The campaign is 25 scenarios instead of 95, and setup takes half the time because the maps are printed directly in a spiral-bound scenario book.

**Play time**: 60-90 minutes per scenario. **Campaign length**: 25 scenarios. **Players**: 1-4. **Complexity**: 3.6/5 on BGG (vs Gloomhaven's 3.9).

If you've never played Gloomhaven, start here. If you have and want something lighter for weeknights, also start here.

[Check price on Amazon](https://www.amazon.com/s?k=Gloomhaven+Jaws+of+the+Lion&tag=boredgame-20)

## Clank! Catacombs

Clank! Catacombs mixes deck building with dungeon crawling in the most approachable way possible. You're adventurers sneaking into a dragon's dungeon, grabbing loot, and trying to escape before the dragon notices. Every card you play makes noise ("Clank!"), and too much noise means the dragon attacks.

The modular dungeon tiles mean the map is different every game. And unlike Gloomhaven, there's no campaign. Each game is a self-contained adventure that takes about 60 minutes.

**Play time**: 45-90 minutes. **Players**: 2-4. **Campaign**: None (standalone sessions). **Complexity**: 2.3/5.

This is the game for groups that want the "explore a dungeon and grab treasure" experience without any ongoing commitment.

[Check price on Amazon](https://www.amazon.com/s?k=Clank+Catacombs+board+game&tag=boredgame-20)

## Sleeping Gods

Sleeping Gods is a narrative adventure game where your crew of sailors is lost in a strange world and needs to find a way home. You explore an atlas-style map, encounter stories, and fight enemies using a unique combat system where you target specific body parts on enemy cards.

The campaign saves between sessions (you literally mark the map and note where you are), but individual sessions run about 90 minutes. The world is open-ended, so you're never grinding through mandatory scenarios.

**Play time**: 60-120 minutes per session. **Campaign length**: About 10-20 hours total. **Players**: 1-4. **Complexity**: 3.1/5.

If you want the adventure and story of Gloomhaven but less tactical crunch and more exploration, Sleeping Gods is it.

[Check price on Amazon](https://www.amazon.com/s?k=Sleeping+Gods+board+game&tag=boredgame-20)

## Escape the Dark Castle

On the opposite end of the spectrum from Gloomhaven's complexity, Escape the Dark Castle is a 30-minute dungeon crawl that uses a deck of oversized cards and custom dice. You're prisoners escaping a castle, flipping cards to reveal rooms and making choices about how to survive.

The retro black-and-white art gives it an old-school RPG feel. The rules fit on a single sheet. And yet the choices matter: do you fight the guard or try to sneak past? Use your limited item now or save it?

**Play time**: 20-45 minutes. **Players**: 1-4. **Campaign**: None. **Complexity**: 1.5/5.

This is the game for people who want dungeon-crawling vibes on a lunch break.

[Check price on Amazon](https://www.amazon.com/s?k=Escape+the+Dark+Castle+board+game&tag=boredgame-20)

## Mice and Mystics

A cooperative adventure game where you play as characters who have been magically turned into mice and must navigate through a castle now filled with gigantic threats. Roaches become monsters, cats become bosses, and a kitchen drain is a dungeon level.

The story is genuinely charming. Each chapter takes about 90 minutes and forms a connected narrative. The combat is simpler than Gloomhaven (dice-based instead of card-based), making it accessible to families and younger players.

**Play time**: 60-90 minutes per chapter. **Campaign length**: 11 chapters. **Players**: 1-4. **Complexity**: 2.6/5.

Best for families or groups that want a storybook dungeon crawl.

[Check price on Amazon](https://www.amazon.com/s?k=Mice+and+Mystics+board+game&tag=boredgame-20)

## How to Choose

| Game | Session Length | Campaign? | Complexity | Best For |
|------|--------------|-----------|------------|----------|
| Jaws of the Lion | 60-90 min | 25 scenarios | Medium | Gloomhaven fans wanting less setup |
| Clank! Catacombs | 45-90 min | No | Low | Casual groups, no commitment |
| Sleeping Gods | 60-120 min | Open world | Medium | Story lovers, explorers |
| Escape the Dark Castle | 20-45 min | No | Very low | Quick sessions, beginners |
| Mice and Mystics | 60-90 min | 11 chapters | Low-medium | Families, story focus |

Not sure which style fits your group? [Try our game finder](/find-a-game) and describe what you're looking for. It handles requests like "cooperative dungeon crawl under 90 minutes" really well.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 4: Best Gateway Board Games for Beginners
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-gateway-board-games-for-beginners',
  title: 'Best Gateway Board Games for People New to the Hobby',
  description: 'The best beginner board games to start your collection. Easy to learn, hard to stop playing. Updated for 2026.',
  tags: ['gateway', 'beginner', 'starter', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-04T12:00:00Z',
  status: 'published',
  content: `Modern board games are nothing like the Monopoly and Risk you grew up with. The hobby has exploded in the last two decades, and there are now thousands of games designed to be fun from the first play. But that abundance makes it hard to know where to start.

These gateway games are the ones that convert people. They're easy to learn, play well with mixed experience levels, and are good enough that veteran gamers still enjoy them years later.

## Ticket to Ride

The game that has probably introduced more people to modern board gaming than any other. You collect colored train cards and use them to claim routes on a map, connecting cities to complete secret destination tickets.

The rules take five minutes. The strategy reveals itself over multiple plays. And the satisfaction of completing a coast-to-coast route never gets old. Multiple map expansions exist (Europe, Nordic Countries, Germany), but the original USA map is still the best starting point.

**Players**: 2-5. **Play time**: 30-60 minutes. **Teach time**: 5 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Ticket+to+Ride+board+game&tag=boredgame-20)

## Carcassonne

Lay tiles, build a medieval landscape, and claim features with your meeples. On your turn, you draw one tile and place it. That's the whole turn structure. But the decisions about where to place it and whether to commit one of your limited meeples create real tension.

Carcassonne scales from "relaxing puzzle" at 2 players to "passive-aggressive territory war" at 4-5 players. It's been in print since 2000 and still sells millions of copies a year, which tells you something about its staying power.

**Players**: 2-5. **Play time**: 30-45 minutes. **Teach time**: 5 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Carcassonne+board+game&tag=boredgame-20)

## Cascadia

Place habitat tiles and populate them with wildlife tokens. Each animal type has its own scoring pattern (foxes want to be adjacent to different animals, bears want to form pairs, salmon want long runs). Match the right animals to the right habitats and score bonus points.

Cascadia won the 2022 Spiel des Jahres and it's one of the most approachable modern games ever made. Zero player interaction in the competitive mode, which sounds boring but actually removes the anxiety of "am I doing this right?" for new players. They can focus on their own puzzle.

**Players**: 1-4. **Play time**: 30-45 minutes. **Teach time**: 5 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Cascadia+board+game&tag=boredgame-20)

## Azul

Draft colored tiles from shared factory displays and place them on your player board in patterns. Complete rows to score points, with bonuses for specific arrangements. Tiles you can't place cost you points.

Azul is beautiful, tactile (the tiles have real weight), and teaches pattern recognition without requiring any prior gaming knowledge. The drafting creates natural tension because taking a tile you want might leave your opponent something even better.

**Players**: 2-4. **Play time**: 30-45 minutes. **Teach time**: 5 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Azul+board+game&tag=boredgame-20)

## Wingspan

Build an engine of birds. Each bird you play has a unique ability that triggers when you activate its habitat. Over four rounds, your tableau of birds becomes a chain of cascading effects that gets more powerful every turn.

Wingspan is slightly more complex than the other games on this list (your first game will take a bit longer), but the bird theme is incredibly inviting and the production quality is stunning. Over 170 unique bird cards, each with real species information and original art. It's the game that makes non-gamers say "wait, this is what board games are now?"

**Players**: 1-5. **Play time**: 40-70 minutes. **Teach time**: 15 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Wingspan+board+game&tag=boredgame-20)

## Pandemic

If competition isn't your group's thing, Pandemic is the go-to cooperative gateway game. You're disease-fighting specialists working together to cure four plagues spreading across the world. Each player has a unique role, and you win or lose as a team.

The cooperative element removes the "I don't want to make a bad move and look dumb" anxiety that kills some new players' experience. You talk through decisions together, more experienced players can gently guide without being overbearing, and the shared victories feel earned.

**Players**: 2-4. **Play time**: 45 minutes. **Teach time**: 10 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Pandemic+board+game&tag=boredgame-20)

## What Makes a Good Gateway Game

A few characteristics that all great gateway games share:

- **Rules you can explain in under 10 minutes** without the other person's eyes glazing over
- **Turns that are simple** but decisions that are interesting
- **A theme that makes sense** to people who aren't already gamers
- **30-60 minute play time** so nobody feels trapped
- **Works at common player counts** (especially 3-4)

## What Comes After Gateway Games?

Once your group is comfortable with these, the natural next steps are:

- **Loved Ticket to Ride?** Try Concordia or Power Grid
- **Loved Carcassonne?** Try Isle of Skye or Kingdomino
- **Loved Wingspan?** Try Terraforming Mars or Everdell
- **Loved Pandemic?** Try Spirit Island or Forbidden Desert

Want a recommendation based on what your group already likes? [Try our game finder](/find-a-game). It's free and takes about 60 seconds.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 5: Best Cooperative Board Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-cooperative-board-games',
  title: 'Best Cooperative Board Games Where Everyone Wins (or Loses) Together',
  description: 'Top co-op board games for groups that hate competition. From Pandemic to Spirit Island, here are the best.',
  tags: ['cooperative', 'co-op', 'teamwork', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-05T12:00:00Z',
  status: 'published',
  content: `Cooperative board games solve the biggest problem in gaming: the person who hates losing. When everyone wins or loses together, the table dynamic completely changes. You're strategizing as a team, celebrating shared victories, and blaming the game (not each other) when things go wrong.

Here are the best co-op games across every complexity level.

## Best for Beginners: Pandemic

Four diseases are spreading across the globe. You and your team of specialists need to find cures before outbreaks spiral out of control. Each player has a unique role (the Medic removes disease cubes efficiently, the Scientist needs fewer cards to cure, the Dispatcher can move other players).

Pandemic defined the modern co-op genre when it released in 2008, and it's still the best introduction to cooperative gaming. The escalating tension as the infection deck cycles is a brilliantly simple mechanic that keeps every game dramatic.

**Players**: 2-4. **Play time**: 45 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Pandemic+board+game&tag=boredgame-20)

## Best 2-Player: Sky Team

A pilot and co-pilot must land a plane by secretly assigning dice to different cockpit functions: speed, axis, landing gear, flaps, radio. You can't discuss your dice values. You can only communicate through the decisions you make and hope your partner picks up on the signals.

Every game of Sky Team creates genuine "did you just...?" moments. It won the 2024 Spiel des Jahres and deserved it. The included scenario book has dozens of airports with escalating difficulty, from training flights to harrowing landings.

**Players**: 2. **Play time**: 20 minutes. **Complexity**: 2.2/5.

[Check price on Amazon](https://www.amazon.com/s?k=Sky+Team+board+game&tag=boredgame-20)

## Best Theme: Spirit Island

You are spirits of a remote island fighting colonial invaders. Unlike most co-op games where you're reacting to crises, Spirit Island lets you be proactive. Each spirit plays completely differently (a river spirit controls the flow of invaders, a lightning spirit strikes fast, a jungle spirit slowly overgrows settlements).

This is the co-op game for groups that found Pandemic too simple. The power card system creates incredible combo potential, and the asymmetric spirits mean you'll want to try different combinations for dozens of plays.

**Players**: 1-4. **Play time**: 90-120 minutes. **Complexity**: 4.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Spirit+Island+board+game&tag=boredgame-20)

## Best Card Game: The Crew: Mission Deep Sea

A cooperative trick-taking game with 32 escalating missions. Each mission assigns specific tricks to specific players, and you need to win them in order. The catch: you can only give one clue about your hand per mission using a limited communication token.

It's the rare co-op game that works brilliantly at 3, 4, and 5 players (with a solid 2-player variant). The card play is sharp, the missions are well-designed, and the whole thing fits in your pocket.

**Players**: 3-5 (2 with variant). **Play time**: 20 minutes. **Complexity**: 2.1/5.

[Check price on Amazon](https://www.amazon.com/s?k=The+Crew+Mission+Deep+Sea&tag=boredgame-20)

## Best Epic Experience: Frosthaven

The follow-up to Gloomhaven is even bigger. Frosthaven puts your party in a remote outpost that you need to protect and develop between dungeon scenarios. You're managing resources, building upgrades, and making story decisions that permanently alter your campaign.

This is a 100+ hour commitment with a group. But if you have a dedicated group that meets regularly, Frosthaven is the deepest cooperative experience in board gaming. The tactical combat uses the same hand-management system as Gloomhaven but with new classes and a harsher setting.

**Players**: 1-4. **Play time**: 90-150 minutes per scenario. **Complexity**: 3.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Frosthaven+board+game&tag=boredgame-20)

## Best Family Co-op: Forbidden Island

Designed by the same person who made Pandemic, Forbidden Island is a simpler, faster cooperative experience. Your team of adventurers is on a sinking island, racing to collect four treasures and escape before the island disappears beneath the waves.

The "island sinking" mechanic is immediately understandable (even kids get it), and the difficulty is adjustable. It's the co-op game most likely to work at Thanksgiving with relatives who think board games mean Trivial Pursuit.

**Players**: 2-4. **Play time**: 30 minutes. **Complexity**: 1.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Forbidden+Island+board+game&tag=boredgame-20)

## The Quarterbacking Problem

The biggest issue with co-op games is "quarterbacking" where one experienced player tells everyone else what to do. A few games handle this better than others:

- **Sky Team**: Dice are secret, so you literally can't quarterback
- **The Crew**: You can't discuss your hand
- **Spirit Island**: Each spirit is so complex that no one can track everyone's options

If quarterbacking is a problem in your group, prioritize games with hidden information or high individual complexity.

Not sure which co-op fits your group? [Try our game finder](/find-a-game) and select "cooperative" as your preference.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 6: Best Solo Board Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-solo-board-games-to-play-alone',
  title: 'Best Solo Board Games for When You Just Want to Play Alone',
  description: 'The best single-player board games that are worth setting up for one. From puzzly to epic, no opponents needed.',
  tags: ['solo', 'single player', '1 player', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-06T12:00:00Z',
  status: 'published',
  content: `Solo board gaming has gone from a niche afterthought to one of the fastest-growing segments of the hobby. Publishers now design dedicated solo modes from the start, and some games are built exclusively for one player. If you've ever thought "I want to play a board game but nobody's around," these are for you.

## Mage Knight

If you want one solo game and you're willing to invest in learning it, Mage Knight is the one. You explore a procedurally generated fantasy landscape, recruit units, cast spells, and siege cities using a hand-management system that rewards careful planning.

A single game takes 2-4 hours solo. The learning curve is steep (budget two plays before you really understand the card combos). But once it clicks, Mage Knight offers a puzzle depth that makes every session feel like solving a complex riddle. It's been the #1 solo game on BGG for over a decade for a reason.

**Play time**: 2-4 hours. **Complexity**: 4.3/5. **BGG Solo Rank**: Consistently top 5.

[Check price on Amazon](https://www.amazon.com/s?k=Mage+Knight+board+game&tag=boredgame-20)

## Spirit Island

Already mentioned in the co-op article, but Spirit Island might be even better solo. Playing two spirits at once gives you full control over the combo potential, and the escalating difficulty curve is perfectly tuned for solo play.

**Play time**: 60-90 minutes (one spirit) or 90-120 minutes (two spirits). **Complexity**: 4.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Spirit+Island+board+game&tag=boredgame-20)

## Cascadia

Not every solo game night needs to be a brain-burner. Cascadia's solo mode gives you a series of scoring challenges to beat, and the puzzle of optimizing your wildlife placement is deeply satisfying without being stressful.

Setup takes two minutes, play takes 20-30 minutes, and cleanup is fast. It's the solo game you'll play most often because the friction to getting it to the table is nearly zero.

**Play time**: 20-30 minutes. **Complexity**: 1.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Cascadia+board+game&tag=boredgame-20)

## Arkham Horror: The Card Game

A narrative-driven card game where you build a deck representing an investigator exploring Lovecraftian mysteries. Each scenario is a chapter in a longer campaign, and your choices carry forward. Characters can go insane, get injured, or discover ancient artifacts that change future sessions.

The gameplay loop of building and refining your deck between scenarios is addictive. And the amount of content available (Fantasy Flight has been releasing expansion campaigns since 2016) means you'll never run out.

**Play time**: 45-90 minutes per scenario. **Complexity**: 3.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Arkham+Horror+Card+Game&tag=boredgame-20)

## Friday

A deck-building game designed specifically for one player. You're Robinson Crusoe's companion Friday, trying to help him survive the island and eventually defeat two pirate ships. Your starting deck is full of terrible cards, and through fighting hazards, you slowly upgrade it.

Friday costs about $15, plays in 25 minutes, and fits in a sandwich bag. It's one of the few solo games that was designed from the ground up for one player (not adapted from a multiplayer game), and it shows. The difficulty is punishing but fair.

**Play time**: 25 minutes. **Complexity**: 1.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Friday+board+game+Friedemann+Friese&tag=boredgame-20)

## Wingspan

The automa (solo AI opponent) in Wingspan is well-designed and simple to run. It gives you a competitive target to beat without adding much overhead. Combined with the satisfying engine-building gameplay, Wingspan is an excellent solo experience that doesn't feel like you're playing a compromised version of the multiplayer game.

**Play time**: 40-60 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Wingspan+board+game&tag=boredgame-20)

## Tips for Getting Into Solo Gaming

- **Start with games you already own.** Many popular games (Wingspan, Terraforming Mars, Spirit Island) have excellent solo modes
- **Don't underestimate setup/teardown time.** A 30-minute game that takes 15 minutes to set up feels different solo
- **Try apps first.** Many board games have digital versions that let you test solo before buying physical
- **Join r/soloboardgaming.** The community is incredibly active and welcoming

Want to find solo games that match your taste? [Try our game finder](/find-a-game) and select "1 player" for player count.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 7: Best Deck-Building Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-deck-building-board-games',
  title: 'Best Deck-Building Board Games Ranked for 2026',
  description: 'From Dominion to Dune: Imperium, the best deck builders ranked. Build your engine, crush your opponents.',
  tags: ['deck building', 'card games', 'engine building', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-04-07T12:00:00Z',
  status: 'published',
  content: `Deck building is one of the most satisfying mechanics in board gaming. You start with a weak hand of basic cards and, over the course of the game, purchase better cards to build a unique engine. By the end, you're pulling off combos that would have been impossible in round one. That progression from weak to powerful is incredibly rewarding.

Here are the best deck builders available right now, from pure classics to modern hybrids.

## Dominion

The one that started it all. Donald X. Vaccarino invented the deck-building genre with Dominion in 2008. It won the Spiel des Jahres in 2009. Each game, you choose 10 "Kingdom" card piles from a pool of hundreds, creating a unique market. You buy cards from that market to build a deck that generates money and victory points.

What makes Dominion timeless is its purity. There's no map, no combat, no theme to speak of. Just a pure economic engine puzzle. With over a dozen expansions (each adding 25+ new Kingdom cards), the replayability is essentially infinite.

**Players**: 2-4. **Play time**: 30 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Dominion+board+game&tag=boredgame-20)

## Dune: Imperium

The best deck builder released in the last five years, and it's not even close. Dune: Imperium combines deck building with worker placement, creating a hybrid where the cards in your hand determine which board spaces you can access. Add in a combat phase where you're committing troops and playing intrigue cards, and you get a game with incredible depth.

The Dune theme isn't just pasted on. Allying with the Fremen plays differently from cozying up to the Spacing Guild, and the political intrigue cards create dramatic swings. The Uprising expansion adds team play and new factions.

**Players**: 1-4. **Play time**: 60-120 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Dune+Imperium+board+game&tag=boredgame-20)

## Star Realms

A two-player deck builder that plays in 20 minutes. You're building a space fleet, buying ships and bases from a shared trade row, and attacking your opponent's authority (health) points. The factions (Trade Federation, Blobs, Star Empire, Machine Cult) each have distinct strategies, and cards from the same faction combo together.

Star Realms proves that deck building doesn't need to be a 90-minute affair. It's the perfect lunchtime game, travel game, or "one more quick game" game.

**Players**: 2. **Play time**: 20 minutes. **Complexity**: 1.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Star+Realms+card+game&tag=boredgame-20)

## Clank! A Deck-Building Adventure

You're a thief sneaking into a dragon's dungeon to steal artifacts. Every card you buy goes into your deck, and some cards make noise ("Clank!"). Too much noise and the dragon attacks. The deeper you go, the better the loot, but the harder it is to escape.

Clank! adds a board game layer on top of the deck-building core, and the push-your-luck element of "do I go deeper or escape now?" creates moments that pure deck builders don't have. The Catacombs standalone sequel adds modular dungeon tiles for even more variety.

**Players**: 2-4. **Play time**: 30-60 minutes. **Complexity**: 2.2/5.

[Check price on Amazon](https://www.amazon.com/s?k=Clank+board+game&tag=boredgame-20)

## Aeon's End

A cooperative deck builder where you fight massive boss monsters. The twist: you never shuffle your deck. You choose the order of your discard pile, which means you can plan combos two turns in advance. This transforms deck building from a game of luck into a game of precision.

Each mage character has unique abilities, and the boss monsters (called "Nemeses") each require different strategies. The difficulty is high, but the satisfaction of pulling off a perfectly planned combo chain to deal massive damage is unmatched.

**Players**: 1-4. **Play time**: 60 minutes. **Complexity**: 2.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Aeons+End+board+game&tag=boredgame-20)

## What Type of Deck Builder Are You?

- **Pure strategy, minimal luck**: Dominion
- **Theme-heavy hybrid**: Dune: Imperium
- **Quick and aggressive**: Star Realms
- **Adventure and push-your-luck**: Clank!
- **Cooperative boss fighting**: Aeon's End

The deck-building genre has grown far beyond its Dominion roots. Modern deck builders often hybridize with worker placement, area control, or dungeon crawling, so if you like the "build an engine from nothing" concept, there's almost certainly a game that wraps it in a theme you'll love.

[Browse all deck-building games](/browse?mechanic=Deck+Building) or [try our game finder](/find-a-game) for personalized recommendations.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 8: How to Host the Perfect Game Night
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-how-to-host-the-perfect-game-night',
  title: 'How to Host a Board Game Night That People Actually Want to Come Back To',
  description: 'A practical guide to hosting game night, from picking games to managing pacing. No awkward silences required.',
  tags: ['game night', 'hosting', 'guide', 'tips'],
  featured_game_ids: [],
  published_at: '2026-04-08T12:00:00Z',
  status: 'published',
  content: `Hosting game night sounds simple. Pick some games, invite some people, done. But there's a difference between a mediocre game night where half the group checks their phones, and a great one where people are asking "when's the next one?" before they leave.

Here's how to consistently host the second kind.

## The Guest List

Four to six people is the sweet spot. Fewer than four limits your game options. More than six means you're either splitting into groups (which requires multiple games and more hosting effort) or playing party games all night.

Invite people who actually want to be there. One reluctant spouse or friend who "isn't really a games person" can tank the energy. It's better to have four enthusiastic people than six where two are enduring it.

## Game Selection

This is where most hosts mess up. They pick games they want to play instead of games the group will enjoy.

**The formula that works**: Start with a quick warmup (15-20 minutes), play one or two main games (45-90 minutes each), and end with something light if energy is still high.

**Good warmup games**: Love Letter, Coup, SCOUT, For Sale

**Main games for mixed groups**: Ticket to Ride, Azul, Carcassonne, Codenames

**Main games for experienced groups**: Wingspan, Everdell, Dune: Imperium, Spirit Island

**Late-night closers**: Codenames, Wavelength, Telestrations

Prepare three options for the main game and let the group choose. This prevents the "I'm forcing you to play my favorite game" dynamic.

## The Teach

How you explain a game determines whether people enjoy it. Bad teaches create confused, frustrated players who blame the game instead of the explanation.

**The formula**:

1. **Theme first**: "You're building a medieval landscape" is better than "you draw one tile per turn"
2. **Win condition second**: "Most points wins, and you get points by..."
3. **Turn structure third**: "On your turn, you do one thing..."
4. **Details last**: Don't explain edge cases until they come up

Keep the teach under 5 minutes for gateway games, under 10 for medium games. If a game needs more than 10 minutes to explain, consider whether it's right for the group.

## Pacing

The most common mistake is playing too few games for too long. If a game is dragging, it's okay to call it. "Let's count up points and switch to something else" is always an acceptable move.

Alternate between energetic and calm games. Three competitive strategy games in a row is exhausting. A party game between two strategy games keeps the energy flowing.

**Kill transitions fast.** Have the next game ready while the current one wraps up. The dead time between games is when people reach for their phones and the momentum dies.

## Food and Drinks

Keep it simple and board-game-friendly:

- **Finger food that doesn't leave residue**: Pretzels, grapes, crackers, veggies
- **Avoid**: Cheetos, wings, anything with sauce (your game components will thank you)
- **Drinks**: Whatever your group likes, but keep napkins nearby

Serve food before gaming starts or during a break, not during play. People can't focus on their turn while loading a plate.

## Table Setup

Clear the table completely. Game boards need space, and cluttered tables lead to knocked-over drinks and misplaced components.

Good lighting matters more than you think. Dim mood lighting is terrible for reading card text. Bright, even overhead lighting makes the game more playable.

If you have a dining table, use it. Coffee tables force people to lean forward for hours, which gets uncomfortable fast.

## Common Mistakes to Avoid

- **Don't teach while setting up.** Set up beforehand so you can focus on the teach
- **Don't play a game nobody at the table has played.** At least one person should know the rules cold
- **Don't force everyone into the same game.** If you have 6+ people, two groups playing different games is fine
- **Don't forget to actually start.** Social time is great, but at some point someone needs to say "okay, let's play"

## Building a Regular Group

The secret to a thriving game night is consistency. Pick a day (every other Tuesday, first Saturday of the month) and stick to it. It's okay if not everyone can make every session. Having a regular schedule means people plan around it.

Need help picking the right games for your group? [Try our game finder](/find-a-game) and describe your group's preferences. It'll suggest games that match your player count, time, and experience level.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 9: Best Worker Placement Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-worker-placement-board-games',
  title: 'Best Worker Placement Board Games for Every Experience Level',
  description: 'The best worker placement games from beginner-friendly to brain-melting. Place your workers, block your opponents.',
  tags: ['worker placement', 'strategy', 'euro games', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-09T12:00:00Z',
  status: 'published',
  content: `Worker placement is one of the defining mechanics of modern euro-style board games. The concept is simple: you have a limited number of workers, and you place them on shared action spaces. Once a space is taken, nobody else can use it that round. Every worker you place is simultaneously gaining you something and blocking your opponents from getting the same thing.

That tension between "what do I need" and "what can I deny" is what makes worker placement addictive.

## Beginner-Friendly: Lords of Waterdeep

Set in the Dungeons & Dragons city of Waterdeep, you're a secret lord recruiting adventurers (colored cubes) to complete quests. Place a worker on a building to collect fighters, rogues, clerics, or wizards. Complete quests for points.

Lords of Waterdeep is the perfect first worker placement game because the theme makes the mechanic intuitive. "I need fighters, so I go to the warrior's guild" just makes sense. The secret lord cards give each player a hidden scoring bonus, adding a layer of strategy without complexity.

**Players**: 2-5. **Play time**: 60 minutes. **Complexity**: 2.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Lords+of+Waterdeep+board+game&tag=boredgame-20)

## Best Overall: Everdell

Place workers to gather resources, then spend those resources to play critter and construction cards into your personal tableau. Your woodland city grows from an empty meadow into a bustling community. Some cards combo with others (the Husband pairs with the Wife, the Dungeon holds prisoners), creating satisfying chains.

Everdell's production quality is absurd. A 3D cardboard tree sits in the center of the table holding event cards. The art is gorgeous. But underneath the charm is a serious strategy game where managing your limited workers across four seasons requires real planning.

**Players**: 1-4. **Play time**: 40-80 minutes. **Complexity**: 2.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Everdell+board+game&tag=boredgame-20)

## Best Hybrid: Dune: Imperium

Already covered in the deck-building article, but Dune: Imperium deserves a mention here because its worker placement is excellent. The cards in your hand determine which board spaces are available to you, creating a dynamic where your options change every turn. It's not a static "these are the 12 spots" game. Your deck reshaping your worker placement options is brilliant.

**Players**: 1-4. **Play time**: 60-120 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Dune+Imperium+board+game&tag=boredgame-20)

## Best Heavy: A Feast for Odin

Uwe Rosenberg's magnum opus. You're Vikings exploring, raiding, trading, and crafting across a massive board with over 60 action spaces. After placing workers, you fill your personal board with polyomino tiles (Tetris-like shapes) from your conquests.

A Feast for Odin is enormous in every way: the board is huge, the game takes 2-3 hours, and the strategic space is vast. But it's also incredibly satisfying because you genuinely feel like you're building a Viking economy from scratch. The polyomino puzzle adds a spatial element that pure worker placement games lack.

**Players**: 1-4. **Play time**: 90-180 minutes. **Complexity**: 3.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=A+Feast+for+Odin+board+game&tag=boredgame-20)

## Best Theme: Viticulture

Run a vineyard in Tuscany. Plant vines, harvest grapes, make wine, fill orders. The seasonal worker placement (some spaces are available in summer, others in winter) creates a rhythm that maps perfectly to the winemaking theme.

The "grande worker" (a special worker that can use occupied spaces) is a clever solution to the frustration of being blocked from a critical action. Viticulture is one of the few worker placement games where the theme and mechanics are in perfect harmony.

**Players**: 1-6. **Play time**: 45-90 minutes. **Complexity**: 2.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Viticulture+Essential+Edition+board+game&tag=boredgame-20)

## Best for Two Players: Agricola

Agricola is the classic "farm builder" where you're a medieval farmer trying to feed your family while expanding your homestead. Plant crops, raise animals, build fences, upgrade your house. The feeding requirement creates constant pressure: every round you need food, and falling behind means begging for scraps (negative points).

At two players, the blocking is sharp and personal. When your opponent takes the "plow field" space you needed, it hurts. The occupation and improvement cards add variety, but the core game is a lean, mean farming machine.

**Players**: 1-4. **Play time**: 30-150 minutes. **Complexity**: 3.6/5.

[Check price on Amazon](https://www.amazon.com/s?k=Agricola+board+game&tag=boredgame-20)

## Worker Placement Progression Path

1. **Lords of Waterdeep** (learn the mechanic)
2. **Everdell** or **Viticulture** (add tableau building)
3. **Agricola** (feel the pressure)
4. **Dune: Imperium** (add deck building)
5. **A Feast for Odin** (full sandbox)

[Browse worker placement games](/browse?mechanic=Worker+Placement) or [get personalized picks](/find-a-game).`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 10: Best Party Games for Large Groups
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-party-board-games-for-large-groups',
  title: 'Best Party Board Games for 6+ Players',
  description: 'The best party games for big groups. No awkward icebreakers, just games that get loud and stay fun.',
  tags: ['party games', 'large groups', '6+ players', 'social'],
  featured_game_ids: [],
  published_at: '2026-04-10T12:00:00Z',
  status: 'published',
  content: `Large group game nights have different requirements than four-player strategy sessions. You need games that accommodate 6+ players, keep everyone engaged even when it's not their turn, and don't require a 10-minute rules explanation. You also need games that generate table-wide reactions. The best party games create shared moments everyone remembers.

## Wavelength

One player (the "Psychic") sees where a target sits on a spectrum (like "Hot to Cold" or "Underrated to Overrated") and gives a one-word clue. Their team then debates where to set the dial. The clue "Mercury" on the "Hot to Cold" spectrum seems obvious until the team argues about whether Mercury the planet or Mercury the element is hotter.

Wavelength creates more heated, hilarious debates per minute than any other game. Every clue sparks a conversation, and even wrong guesses lead to "wait, why did you think that?" moments. Plays 2-12 in teams.

[Check price on Amazon](https://www.amazon.com/s?k=Wavelength+board+game&tag=boredgame-20)

## Codenames

Two teams, one shared grid of 25 words. Each team's spymaster gives one-word clues that connect multiple words on the grid. "Animals, 3" might connect "bat," "crane," and "bear." But "crane" could also be a machine, and one wrong guess could hit the assassin word and lose the game instantly.

Codenames has sold millions of copies because the core concept is brilliant and endlessly replayable. No two games feel the same because the word grid is always different. Plays 4-8+ in teams.

[Check price on Amazon](https://www.amazon.com/s?k=Codenames+board+game&tag=boredgame-20)

## Telestrations

Telephone meets Pictionary. Everyone starts with a word, draws it, passes their sketchbook, the next person guesses what the drawing is, passes it, the next person draws that guess, and so on. By the time the sketchbook comes back to you, "bicycle" has somehow become "angry octopus."

Telestrations requires zero skill at drawing. In fact, the worse you are, the funnier it gets. It's the perfect game for mixed groups because there's no winning or losing, just laughing. Plays 4-12.

[Check price on Amazon](https://www.amazon.com/s?k=Telestrations+board+game&tag=boredgame-20)

## Decrypto

A step up from Codenames in complexity, but worth it. Two teams each have four secret words. Each round, one team member gives three clues to communicate a three-digit code to their team. The opposing team listens to the clues and tries to intercept (crack) the code.

The genius is that you need clues specific enough for your team to understand but vague enough that the opponents can't crack them over multiple rounds. "Citrus, 1960s, strings" means "Orange, Kennedy, Guitar" to your team, but the other team is building a dossier of your clue patterns. Plays 3-8 in teams.

[Check price on Amazon](https://www.amazon.com/s?k=Decrypto+board+game&tag=boredgame-20)

## One Night Ultimate Werewolf

Everyone gets a secret role card (werewolf, seer, troublemaker, etc.), closes their eyes, and roles activate one at a time during a "night" phase. Then everyone opens their eyes and has five minutes of frantic discussion to figure out who the werewolves are before voting.

Unlike classic Werewolf, nobody gets eliminated. One round takes 10 minutes, so you can play five games in an hour. The free companion app handles the night phase narration perfectly. Plays 3-10.

[Check price on Amazon](https://www.amazon.com/s?k=One+Night+Ultimate+Werewolf&tag=boredgame-20)

## Just One

A cooperative party game where everyone writes a one-word clue to help one player guess a secret word. The twist: any duplicate clues get eliminated before the guesser sees them. If everyone writes "yellow" as a clue for "banana," the guesser sees nothing.

This creates a fascinating meta-game where you're trying to be helpful but not obvious. "Should I write 'peel' or will everyone else think of that?" Just One won the 2019 Spiel des Jahres and works with 3-7 players.

[Check price on Amazon](https://www.amazon.com/s?k=Just+One+board+game&tag=boredgame-20)

## Picking the Right Party Game

- **Word people**: Codenames, Decrypto, Just One
- **Debate lovers**: Wavelength
- **Art/creativity**: Telestrations
- **Drama and deception**: One Night Ultimate Werewolf
- **Everyone's first game night**: Telestrations (lowest barrier to entry)

Want suggestions based on your group size and vibe? [Try our game finder](/find-a-game) and set the player count to your group size.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 11: What Comes After Catan
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-board-games-to-play-after-catan',
  title: 'Graduated from Catan? Here\'s What to Play Next',
  description: 'Loved Catan but ready for more? These next-step board games build on what you already enjoy with deeper strategy.',
  tags: ['catan', 'gateway', 'next step', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-04-11T12:00:00Z',
  status: 'published',
  content: `Catan is where millions of people discover that board games can actually be good. The trading, the building, the "I really need brick" negotiations. But after a dozen plays, the randomness of the dice starts to grate, the robber feels arbitrary, and you're ready for something with more strategic depth.

The trick is finding a game that scratches the same itch (building something, competing for resources, player interaction) without jumping straight to a three-hour brain-burner. Here are the best next steps.

## If You Loved the Trading: Concordia

Concordia looks boring on the table (a map of the Roman Mediterranean, wooden houses, cards with Latin names). But it's one of the most elegant strategy games ever designed. You play cards to take actions: produce goods, move your colonists, trade at markets, or establish new trading houses in cities.

What makes Concordia the perfect Catan graduation is that the trading happens through the game's systems, not through negotiation. No more "will you trade two wheat for a sheep?" conversations. You're still building an economic engine, but you're in full control.

**Players**: 2-5. **Play time**: 90 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Concordia+board+game&tag=boredgame-20)

## If You Loved Building a Tableau: Terraforming Mars

You're a corporation making Mars habitable. Play project cards to raise temperature, create oceans, and plant forests. Each card has a unique effect, and the synergies between them create satisfying combos as your engine grows.

Terraforming Mars scratches the same "build my empire" itch as Catan but with far more variety. There are over 200 unique project cards, and each game you'll use maybe 30 of them. The hex tile placement on the Mars board even gives you that "claiming territory" feeling.

**Players**: 1-5. **Play time**: 90-120 minutes. **Complexity**: 3.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Terraforming+Mars+board+game&tag=boredgame-20)

## If You Loved Route Building: Power Grid

Like Catan, Power Grid has you building a network on a map. But instead of roads and settlements, you're building power plants and connecting cities to your electrical grid. You buy power plants at auction, buy fuel on a dynamic market, and expand your network to supply the most cities.

Power Grid's market mechanics are brilliant. As players buy fuel, prices rise. As power plants age, newer ones become available. The economy feels alive in a way Catan's dice never could.

**Players**: 2-6. **Play time**: 120 minutes. **Complexity**: 3.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Power+Grid+board+game&tag=boredgame-20)

## If You Loved the Dice: Space Base

Space Base is "Catan's dice but better." You have a personal board with slots numbered 1-12. On your turn, roll two dice and activate the corresponding slots. On other players' turns, you activate different abilities. Over the game, you buy new ship cards to slot into your board, customizing what each number does for you.

The key improvement over Catan: you activate something on every single roll, not just your own turn. No more sitting idle while other people roll. The engine you build determines what's good for you, creating that "I hope someone rolls a 9" excitement without the frustration of getting nothing.

**Players**: 2-5. **Play time**: 60 minutes. **Complexity**: 2.1/5.

[Check price on Amazon](https://www.amazon.com/s?k=Space+Base+board+game&tag=boredgame-20)

## If You Loved the Simplicity: Carcassonne

If the thing you loved most about Catan was how approachable it felt, Carcassonne is the perfect next game. Draw a tile, place a tile, optionally place a meeple. That's a turn. But the decisions about where to place and when to commit your limited meeples create real tension.

Carcassonne is actually simpler than Catan in terms of rules, but the strategy runs deep once you understand farming and shared features. It's one of the few games that works equally well as a relaxing 2-player experience and a cutthroat 5-player battle.

**Players**: 2-5. **Play time**: 30-45 minutes. **Complexity**: 1.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Carcassonne+board+game&tag=boredgame-20)

## If You Loved Player Interaction: Cosmic Encounter

Catan's player interaction is mostly "will you trade with me?" Cosmic Encounter turns that up to 11. Every turn, you attack another player's planet. Both sides can invite allies, play special cards, and negotiate. And every single player has a unique alien power that breaks the rules in a different way.

The Fantasy Flight edition (2008) includes 50 alien powers in the base game alone, and they create wildly different dynamics. The original Cosmic Encounter has been around since 1977 because no other game captures the chaos of negotiation, alliances, and betrayal this well.

**Players**: 3-5. **Play time**: 60-90 minutes. **Complexity**: 2.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Cosmic+Encounter+board+game&tag=boredgame-20)

## The Progression Path

Catan lovers generally fit into two paths:

**Path A (less complexity, more interaction)**: Catan > Carcassonne > Space Base > Cosmic Encounter

**Path B (more strategy, deeper engines)**: Catan > Concordia > Terraforming Mars > Power Grid

Not sure which path is yours? [Try our game finder](/find-a-game) and tell it you like Catan. It'll figure out the rest.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 12: Best Legacy Board Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-legacy-board-games-campaign',
  title: 'Best Legacy Board Games With Campaigns Worth the Commitment',
  description: 'The best legacy and campaign board games that permanently change as you play. Worth the 20+ hour investment.',
  tags: ['legacy', 'campaign', 'story', 'long-term'],
  featured_game_ids: [],
  published_at: '2026-04-12T12:00:00Z',
  status: 'published',
  content: `Legacy board games are designed to change permanently as you play them. You'll write on the board, tear up cards, add stickers, and unlock sealed boxes of new content. By the end, your copy of the game is unique to your group's decisions.

It's a big commitment. Most legacy games take 12-24 sessions to complete. But if you have a dedicated group, the payoff is unlike anything else in board gaming. Here are the ones worth your time.

## Pandemic Legacy: Season 1

The game that made legacy a genre. It starts as regular Pandemic (cure four diseases cooperatively), but by the second month, the story kicks in and nothing is the same. Characters gain scars that permanently affect their abilities. Cities fall. New rules emerge from sealed boxes. By December (the final month), you're playing a completely different game than you started.

Season 1 held the #1 spot on BGG for years and remains one of the highest-rated games of all time. The narrative beats hit hard, the mechanical escalation is perfectly paced, and the shared experience of opening a sealed packet together creates memories you'll talk about for years.

**Sessions**: 12-24 (one per in-game month, with retry opportunities). **Play time**: 60 minutes per session. **Players**: 2-4. **Complexity**: 2.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Pandemic+Legacy+Season+1&tag=boredgame-20)

## Gloomhaven

The largest, most ambitious legacy-style game ever made. You're mercenaries exploring a branching campaign of 95 scenarios, retiring characters, unlocking new classes, and watching the world change based on your choices. The card-driven combat system (no dice) rewards tactical planning.

Gloomhaven is a 150+ hour investment. That's not an exaggeration. But the character progression is incredible. Each of the 17 unlockable classes plays completely differently, and retiring one character to start another feels like starting a new game within the same world.

**Sessions**: 95 scenarios (you'll play 60-70 in a single campaign). **Play time**: 90-150 minutes per scenario. **Players**: 1-4. **Complexity**: 3.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Gloomhaven+board+game&tag=boredgame-20)

## Ticket to Ride Legacy: Legends of the West

If Pandemic Legacy and Gloomhaven sound intimidating, Ticket to Ride Legacy is the perfect entry point. It takes the familiar route-claiming gameplay and adds a 12-game campaign across the American frontier. Each game unlocks new rules, new map elements, and new story beats.

The difficulty is gentle enough for families, the sessions are 60-90 minutes, and you don't need any prior Ticket to Ride experience. It's the legacy game most likely to work with a mixed-experience group.

**Sessions**: 12. **Play time**: 60-90 minutes per session. **Players**: 2-5. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Ticket+to+Ride+Legacy+Legends+of+the+West&tag=boredgame-20)

## Clank! Legacy: Acquisitions Incorporated

Clank! Legacy takes the deck-building dungeon crawl of Clank! and adds a 10+ game campaign with stickers, new cards, and a story that permanently alters the game board. The humor is based on the Acquisitions Incorporated D&D brand, which means it's genuinely funny rather than taking itself too seriously.

Each game stands alone as a complete Clank! session, so even if your group never finishes the campaign, every individual game is satisfying. After the campaign, the modified board works as a unique version of standard Clank!.

**Sessions**: 10+. **Play time**: 60-90 minutes per session. **Players**: 2-4. **Complexity**: 2.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Clank+Legacy+Acquisitions+Incorporated&tag=boredgame-20)

## My City

A lightweight legacy game where you build a city by placing polyomino tiles onto a personal board. Over 24 episodes across 8 "chapters," new rules introduce rivers, industrial buildings, and special scoring conditions. Each player's board permanently changes with stickers.

My City is Reiner Knizia's take on legacy, and it's brilliantly accessible. Episodes take 30 minutes, the rules are simple enough for families, and the 24-episode campaign doesn't overstay its welcome.

**Sessions**: 24 (short episodes). **Play time**: 30 minutes per episode. **Players**: 2-4. **Complexity**: 2.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=My+City+board+game&tag=boredgame-20)

## Before You Commit

Legacy games require a consistent group. Before buying one, make sure:

- You have 2-4 people who can commit to regular sessions
- Everyone is okay with permanently altering game components
- You're prepared for the possibility of not finishing (life happens)
- Someone is willing to organize scheduling (the hardest part)

The biggest enemy of legacy games isn't difficulty or length. It's scheduling.

Need help finding the right legacy game for your group? [Try our game finder](/find-a-game) and filter by campaign games.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 13: Best Engine Building Games
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-engine-building-board-games',
  title: 'Best Engine-Building Board Games That Get More Satisfying Every Turn',
  description: 'The most satisfying engine-building board games where your turns get better and better. From Wingspan to Terraforming Mars.',
  tags: ['engine building', 'strategy', 'combo', 'euro games'],
  featured_game_ids: [],
  published_at: '2026-04-13T12:00:00Z',
  status: 'published',
  content: `Engine building is the mechanic that hooks people on board gaming. The concept: you start with almost nothing, and over the course of the game, you construct a system that produces more and more output. Your first turn generates one resource. By the last turn, a single action triggers a cascade of effects that scores thirty points.

That exponential growth curve is one of the most satisfying experiences in gaming. Here are the best games that deliver it.

## Wingspan

An engine-building game about attracting birds to wildlife preserves. Each bird card has a unique ability that triggers when you activate its habitat. As you fill rows with birds, each action in that habitat triggers every bird in sequence, creating longer and more powerful chains.

Wingspan made engine building accessible to a mass audience. The bird theme is inviting, the production quality is excellent (custom egg miniatures, a bird feeder dice tower), and the strategic depth holds up over many plays. The bird powers range from simple (gain food) to complex (tuck cards for end-game scoring), so your engine always feels unique.

**Players**: 1-5. **Play time**: 40-70 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Wingspan+board+game&tag=boredgame-20)

## Terraforming Mars

Play project cards to raise oxygen, temperature, and ocean levels on Mars. Each card has a cost, a tag, and an effect. The magic is in the tag synergies: microbe cards boost each other, plant cards chain together, space cards reduce future space card costs.

By mid-game, you're producing dozens of resources per round from a tableau of 15+ cards that all interact. The feeling of a well-tuned Terraforming Mars engine firing on all cylinders is peak engine building. The downside: games can run long (2+ hours with new players).

**Players**: 1-5. **Play time**: 90-120 minutes. **Complexity**: 3.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Terraforming+Mars+board+game&tag=boredgame-20)

## Earth

The newest contender for the Wingspan/Terraforming Mars crown. Earth is a nature-themed engine builder where you play flora cards to grow an island ecosystem. Each turn, every player takes an action, but the active player gets a bigger version of it. Your tableau grows, fauna cards score based on conditions in your ecosystem, and composting creates a resource engine underneath everything.

Earth has over 400 unique cards and plays faster than Terraforming Mars (about 45-60 minutes) while offering similar depth. The simultaneous turns keep downtime low even at 5 players.

**Players**: 1-5. **Play time**: 45-90 minutes. **Complexity**: 2.6/5.

[Check price on Amazon](https://www.amazon.com/s?k=Earth+board+game&tag=boredgame-20)

## Gizmos

A marble-dispensing machine sits in the center of the table. You draw marbles (energy) to pay for gizmo cards that give you new abilities. Some gizmos trigger when you pick up a specific color marble. Others trigger when you build certain types of gizmos. Chain enough triggers together and a single action cascades through five or six effects.

Gizmos is one of the purest engine builders available. Games run 40-50 minutes, the marble dispenser is tactile and fun, and the chain reactions you build by the end are deeply satisfying. It's also one of the best gateway engine builders for new players.

**Players**: 2-4. **Play time**: 40-50 minutes. **Complexity**: 2.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Gizmos+board+game&tag=boredgame-20)

## Res Arcana

An engine builder distilled to its purest form. You start with a hand of just 8 cards (drafted at the beginning) and that's your entire pool for the game. Over 4-6 rounds, you play artifacts that generate essences (resources), convert essences into more powerful effects, and race to 10 points.

Res Arcana games take 30 minutes, but the strategic density is comparable to games three times its length. Every card matters. Every resource decision matters. It's the engine builder for people who want maximum depth in minimum time.

**Players**: 2-4. **Play time**: 20-40 minutes. **Complexity**: 2.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Res+Arcana+board+game&tag=boredgame-20)

## The Engine-Building Spectrum

| Game | Complexity | Length | Style |
|------|-----------|--------|-------|
| Gizmos | Low | 40 min | Chain reactions, marbles |
| Wingspan | Low-Medium | 50 min | Bird abilities cascade |
| Earth | Medium | 60 min | Ecosystem combos |
| Res Arcana | Medium | 30 min | Tight card pool, fast |
| Terraforming Mars | Medium-High | 120 min | Massive card synergies |

If you enjoy the feeling of your turns getting progressively more powerful, engine building is your mechanic. [Browse engine-building games](/browse?mechanic=Engine+Building) or [try our game finder](/find-a-game) for personalized picks.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 14: Best Board Games for Families
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-board-games-for-families-with-kids',
  title: 'Best Board Games for Families That Adults Won\'t Hate',
  description: 'Family board games where adults have as much fun as kids. No Candy Land required. Ages 6+.',
  tags: ['family', 'kids', 'all ages', 'recommendations'],
  featured_game_ids: [],
  published_at: '2026-04-14T12:00:00Z',
  status: 'published',
  content: `The best family board games aren't the ones designed exclusively for kids. They're the ones designed so well that adults and children enjoy them equally. Nobody wants to suffer through Candy Land for the fifteenth time. And nobody needs to. Modern family games are genuinely good.

These picks all work for ages 6-8 and up, and every single one is a game adults will suggest playing even when the kids aren't around.

## Ticket to Ride

Kids understand "collect cards, claim routes" immediately. The map gives them a visual goal to work toward, and the satisfaction of placing plastic trains across the country is universal. Younger kids (6-7) might need help with the longer destination tickets, but the core gameplay is intuitive.

Ticket to Ride is also the game least likely to cause tears, because you're building something rather than attacking anyone. The competition is passive (claiming a route someone else wanted), not aggressive.

**Ages**: 8+ (works fine at 6-7 with guidance). **Players**: 2-5. **Play time**: 30-60 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Ticket+to+Ride+board+game&tag=boredgame-20)

## Kingdomino

Draft domino-like tiles with terrain types and place them in a 5x5 grid to form your kingdom. Crowns multiply the value of connected terrain, so a large forest with two crowns scores big. The twist: the player who picks the worst tile this round gets first pick next round.

Kingdomino won the 2017 Spiel des Jahres and plays in 15-20 minutes. It's the perfect family game: simple enough for a 7-year-old, strategic enough for adults, and short enough that "one more game" never feels like a big ask.

**Ages**: 8+ (works at 6-7). **Players**: 2-4. **Play time**: 15-20 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Kingdomino+board+game&tag=boredgame-20)

## Cascadia

Place tiles, add animals, score patterns. The wildlife theme makes it immediately appealing to kids, and the absence of player interaction means nobody can ruin anyone else's plans. Each player builds their own nature preserve in peaceful parallel.

The solo challenges work great for older kids who want to play independently. And the multiple scoring card combinations mean the "best" strategy changes every game, keeping it fresh for adults.

**Ages**: 10+ (works at 7-8 with scoring help). **Players**: 1-4. **Play time**: 30-45 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Cascadia+board+game&tag=boredgame-20)

## Forbidden Island

A cooperative game where your family works together to collect treasures from a sinking island. The rising water level creates genuine tension, and the cooperative format means older family members can help younger ones without it feeling patronizing.

Matt Leacock (the Pandemic designer) made Forbidden Island specifically as a family-friendly co-op, and it shows. The components are great (actual metal treasure tokens), setup takes two minutes, and the difficulty scales.

**Ages**: 10+ (works at 7-8 in co-op). **Players**: 2-4. **Play time**: 30 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Forbidden+Island+board+game&tag=boredgame-20)

## Sushi Go Party!

Draft cute sushi cards to build the highest-scoring meal. Each round, pick one card and pass the rest. Different sushi types score in different ways (maki rolls score for having the most, tempura scores in pairs, wasabi triples the next nigiri's value).

The card drafting is intuitive ("pick one, pass the rest"), the art is adorable, and the "Party" version lets you customize which sushi types are available each game, keeping it fresh for hundreds of plays. It's the family game with the best gateway-to-strategy ratio.

**Ages**: 8+. **Players**: 2-8. **Play time**: 20 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Sushi+Go+Party+card+game&tag=boredgame-20)

## Mysterium

One player is a ghost communicating through abstract vision cards, trying to lead the other players (psychic investigators) to the correct suspect, location, and weapon. The ghost can't speak. They can only hand out beautifully illustrated cards and hope the psychics interpret them correctly.

Mysterium turns every game into a collaborative puzzle of interpretation. "Why did the ghost give me a card with a tree and a piano? Oh, the suspect is the gardener and the garden has a bench that looks like a piano!" Kids love the mystery-solving aspect, and the ghost role gives an adult a unique challenge.

**Ages**: 10+. **Players**: 2-7. **Play time**: 40 minutes.

[Check price on Amazon](https://www.amazon.com/s?k=Mysterium+board+game&tag=boredgame-20)

## Ages by Game

| Game | True Minimum Age | Play Time | Competitive or Co-op? |
|------|-----------------|-----------|----------------------|
| Kingdomino | 6 | 15 min | Competitive |
| Sushi Go Party! | 7 | 20 min | Competitive |
| Forbidden Island | 7 | 30 min | Cooperative |
| Ticket to Ride | 7 | 45 min | Competitive |
| Cascadia | 8 | 35 min | Competitive |
| Mysterium | 8 | 40 min | Cooperative |

Looking for family games matched to your kids' ages and interests? [Try our game finder](/find-a-game) and select "family" as your preference.`,
},

// ═══════════════════════════════════════════════════════════════════════════
// POST 15: Best Strategy Board Games for Experienced Players
// ═══════════════════════════════════════════════════════════════════════════
{
  slug: 'seed-best-heavy-strategy-board-games',
  title: 'Best Heavy Strategy Board Games for Experienced Players',
  description: 'The best complex, brain-burning strategy board games for experienced players who want maximum depth.',
  tags: ['heavy strategy', 'euro games', 'complex', 'experienced'],
  featured_game_ids: [],
  published_at: '2026-04-15T12:00:00Z',
  status: 'published',
  content: `You've graduated from gateway games. You've played Wingspan, Catan, and Ticket to Ride until the decisions feel automatic. You want games where every choice has cascading consequences, where the decision space is wide enough to develop a personal style, and where losing still teaches you something.

These heavy strategy games deliver. All are rated 3.5+ complexity on BoardGameGeek's 5-point scale.

## Brass: Birmingham

An economic game set during the Industrial Revolution in Birmingham, England. You build industries (cotton mills, iron works, breweries, coal mines), develop canal and rail networks, and sell goods to distant markets. The game plays over two eras, and everything you build in the canal era gets wiped before the rail era.

Brass: Birmingham is currently ranked #3 on BGG's all-time list, and it earns it. The interlocking economic systems create a web of decisions where every action affects the shared market. Building an iron works doesn't just help you. It provides cheap iron to anyone nearby. The shared infrastructure creates constant tension between cooperation and competition.

**Players**: 2-4. **Play time**: 60-120 minutes. **Complexity**: 3.9/5. **BGG Rank**: #3.

[Check price on Amazon](https://www.amazon.com/s?k=Brass+Birmingham+board+game&tag=boredgame-20)

## Great Western Trail

You're a rancher in 19th-century America, herding cattle from Texas to Kansas City. Along the trail, you build buildings, hire workers (cowboys, craftsmen, engineers), and manage a cattle herd represented by a deck of cards. Delivering a diverse herd to Kansas City scores big. Delivering duplicates wastes your trip.

Great Western Trail combines deck building, hand management, and a rondel-like trail into something that feels unlike anything else. The three worker types create genuinely different strategic paths, and the building placement on the shared trail means your choices shape everyone's journey.

**Players**: 1-4. **Play time**: 75-150 minutes. **Complexity**: 3.7/5. **BGG Rank**: Top 20.

[Check price on Amazon](https://www.amazon.com/s?k=Great+Western+Trail+board+game&tag=boredgame-20)

## Gaia Project

The spiritual successor to Terra Mystica, set in space. You're one of 14 asymmetric factions terraforming planets to match your species' needs. Colonize planets, upgrade structures, advance on research tracks, and compete for shared scoring objectives.

Each faction has unique abilities and a different preferred planet type, creating wildly different strategies. The upgrade paths (mines become trading posts become research labs or planetary institutes) create meaningful long-term decisions. Gaia Project rewards mastery like few other games.

**Players**: 1-4. **Play time**: 60-150 minutes. **Complexity**: 4.5/5. **BGG Rank**: Top 20.

[Check price on Amazon](https://www.amazon.com/s?k=Gaia+Project+board+game&tag=boredgame-20)

## Spirit Island

Listed here as a strategy game rather than a co-op because at this complexity level, Spirit Island is fundamentally a brain-burning optimization puzzle. Each spirit has a deck of power cards, an innate ability tree, and a growth track that creates unique strategic considerations.

With the Branch & Claw and Jagged Earth expansions, the depth is staggering. Understanding how to combine two spirits' abilities to control invader flow, manage fear, and trigger innate powers is a strategic challenge that holds up after 50+ plays.

**Players**: 1-4. **Play time**: 90-120 minutes. **Complexity**: 4.0/5. **BGG Rank**: Top 15.

[Check price on Amazon](https://www.amazon.com/s?k=Spirit+Island+board+game&tag=boredgame-20)

## Agricola

The classic "misery farm" game. Everything you need to do (feed your family, expand your house, plow fields, raise animals, build fences) competes for the same limited actions. You're never doing well in Agricola. You're just failing less.

That sounds punishing, and it is. But the tight resource pressure creates incredibly meaningful decisions. Every worker placement matters. Every round where you don't feed your family costs you 3 points per beggar card. The occupation and improvement cards (dealt randomly at the start) give each game a unique strategic puzzle.

**Players**: 1-4. **Play time**: 30-150 minutes. **Complexity**: 3.6/5. **BGG Rank**: ~#60.

[Check price on Amazon](https://www.amazon.com/s?k=Agricola+board+game&tag=boredgame-20)

## Twilight Imperium (4th Edition)

The biggest, most ambitious strategy board game ever made. You lead one of 17+ factions vying for galactic dominance through warfare, politics, technology, and trade. Games take 4-8 hours and involve alliance negotiations, backstabs, and political votes that affect the entire galaxy.

Twilight Imperium isn't a game you play on a Tuesday night. It's an event. You schedule it weeks in advance, clear an entire day, and talk about what happened for months afterward. If you've never experienced a full game of TI4, it's a bucket list item for any strategy gamer.

**Players**: 3-6. **Play time**: 4-8 hours. **Complexity**: 4.2/5. **BGG Rank**: Top 20.

[Check price on Amazon](https://www.amazon.com/s?k=Twilight+Imperium+4th+Edition&tag=boredgame-20)

## Complexity Guide

| Game | Complexity | Best At | Time |
|------|-----------|---------|------|
| Agricola | 3.6 | 3-4 | 90 min |
| Great Western Trail | 3.7 | 3 | 120 min |
| Brass: Birmingham | 3.9 | 3-4 | 100 min |
| Spirit Island | 4.0 | 2 | 110 min |
| Twilight Imperium | 4.2 | 6 | 6 hrs |
| Gaia Project | 4.5 | 3-4 | 120 min |

Ready for a challenge? [Try our game finder](/find-a-game) and tell it you want heavy strategy games. It'll match you with something that fits your group.`,
},

];

// ---------------------------------------------------------------------------
// Main: insert posts (or clean up)
// ---------------------------------------------------------------------------
async function main() {
  const isCleanup = process.argv.includes('--cleanup');

  if (isCleanup) {
    console.log('Cleaning up seeded blog posts...');
    const { data, error } = await supabase
      .from('blog_posts')
      .delete()
      .like('slug', `${SEED_SLUG_PREFIX}%`)
      .select('slug');

    if (error) {
      console.error('Cleanup error:', error);
      process.exit(1);
    }
    console.log(`Deleted ${data?.length ?? 0} seeded posts.`);
    return;
  }

  console.log(`Inserting ${POSTS.length} blog posts...`);

  // Check for existing seeded posts
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('slug')
    .like('slug', `${SEED_SLUG_PREFIX}%`);

  const existingSlugs = new Set((existing ?? []).map((p: { slug: string }) => p.slug));
  const newPosts = POSTS.filter((p) => !existingSlugs.has(p.slug));

  if (newPosts.length === 0) {
    console.log('All seeded posts already exist. Use --cleanup to remove them first.');
    return;
  }

  // Try to resolve game IDs + images for internal linking
  const gameNames = [
    'Patchwork', 'Sky Team', '7 Wonders Duel', 'Lost Cities', 'Hive',
    'Codenames: Duet', 'Jaipur', 'SCOUT', 'The Crew: Mission Deep Sea',
    'Cascadia', 'Love Letter', 'Coup', 'Sea Salt & Paper', 'For Sale',
    'Gloomhaven: Jaws of the Lion', 'Clank! Catacombs', 'Sleeping Gods',
    'Escape the Dark Castle', 'Mice and Mystics', 'Ticket to Ride',
    'Carcassonne', 'Azul', 'Wingspan', 'Pandemic', 'Spirit Island',
    'The Crew: Mission Deep Sea', 'Frosthaven', 'Forbidden Island',
    'Mage Knight Board Game', 'Arkham Horror: The Card Game', 'Friday',
    'Dominion', 'Dune: Imperium', 'Star Realms', 'Clank!: A Deck-Building Adventure',
    "Aeon's End", 'Wavelength', 'Codenames', 'Telestrations', 'Decrypto',
    'One Night Ultimate Werewolf', 'Just One', 'Concordia',
    'Terraforming Mars', 'Power Grid', 'Space Base', 'Cosmic Encounter',
    'Lords of Waterdeep', 'Everdell', 'Viticulture Essential Edition',
    'A Feast for Odin', 'Agricola', 'Pandemic Legacy: Season 1',
    'Gloomhaven', 'Ticket to Ride Legacy: Legends of the West',
    "Clank! Legacy: Acquisitions Incorporated", 'My City', 'Earth',
    'Gizmos', 'Res Arcana', 'Kingdomino', 'Sushi Go Party!',
    'Mysterium', 'Brass: Birmingham', 'Great Western Trail',
    'Gaia Project', 'Twilight Imperium: Fourth Edition',
    'Sushi Go!', 'Codenames Duet',
  ];

  console.log('Resolving game IDs and images from database...');
  const gameMap = new Map<string, GameInfo>();
  for (const name of gameNames) {
    const info = await findGame(name);
    if (info) {
      gameMap.set(name, info);
    }
  }
  console.log(`Found ${gameMap.size} game entries in database.`);

  // Insert posts
  let inserted = 0;
  for (const post of newPosts) {
    let content = post.content;
    const featuredIds: string[] = [];

    // For each game we found in the DB, inject:
    // 1. An internal link right after the Amazon link line
    // 2. A game image if available
    for (const [name, info] of gameMap) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Add "[View on boredgame.lol](/games/ID)" link after Amazon links for this game
      // Match the Amazon link line for this game
      const amazonPattern = new RegExp(
        `(\\[Check price on Amazon\\]\\(https://www\\.amazon\\.com/s\\?k=[^)]*${escapedName.replace(/\s+/g, '\\+')}[^)]*\\))`,
        'i',
      );
      if (amazonPattern.test(content)) {
        content = content.replace(amazonPattern, (match) => {
          featuredIds.push(info.id);
          const viewLink = ` | [View on boredgame.lol](/games/${encodeURIComponent(info.id)})`;
          return match + viewLink;
        });
      }

      // Add game image after the FIRST H2 header that mentions this game (once only)
      if (info.image_url) {
        // Downsize BGG images: swap __original for __imagepage (fits ~250px wide)
        const sizedUrl = info.image_url.replace('__original', '__imagepage');
        const headerPattern = new RegExp(
          `(## [^\\n]*${escapedName}[^\\n]*)\\n`,
          'i',
        );
        // Only replace first match to avoid duplicates
        const firstMatch = content.match(headerPattern);
        if (firstMatch && firstMatch.index !== undefined) {
          const before = content.slice(0, firstMatch.index);
          const after = content.slice(firstMatch.index + firstMatch[0].length);
          const gameUrl = `/games/${encodeURIComponent(info.id)}`;
          content = `${before}${firstMatch[1]}\n\n<a href="${gameUrl}" target="_blank" rel="noopener"><img src="${sizedUrl}" alt="${name}" /></a>\n\n${after}`;
        }
      }
    }

    // Extract any game IDs referenced in the final content
    const gameIdMatches = content.matchAll(/\/games\/([a-zA-Z0-9_%-]+)/g);
    const allGameIds = [...new Set([...featuredIds, ...[...gameIdMatches].map((m) => decodeURIComponent(m[1]))])];

    const { error } = await supabase.from('blog_posts').insert({
      ...post,
      featured_game_ids: allGameIds.length > 0 ? allGameIds : post.featured_game_ids,
      content,
    });

    if (error) {
      console.error(`Failed to insert "${post.title}":`, error.message);
    } else {
      inserted++;
      console.log(`  ✓ ${post.title} (${allGameIds.length} game links)`);
    }
  }

  console.log(`\nDone! Inserted ${inserted}/${newPosts.length} posts.`);
  console.log('Skipped (already exist):', POSTS.length - newPosts.length);
}

main().catch(console.error);
