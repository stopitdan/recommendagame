/**
 * Restore Deleted Blog Posts
 *
 * Recreates the 10 deleted blog posts with their original slugs and
 * approximate publish dates, but with high-quality fact-checked content.
 *
 * Usage: npx tsx scripts/restore-blog-posts.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface GameInfo {
  id: string;
  name: string;
  image_url: string | null;
}

async function findGame(name: string): Promise<GameInfo | null> {
  const { data } = await supabase
    .from('games')
    .select('id, name, image_url')
    .ilike('name', name)
    .limit(1)
    .single();
  return data ? { id: data.id, name: data.name, image_url: data.image_url } : null;
}

interface RestoredPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  featured_game_ids: string[];
  published_at: string;
  status: 'published';
}

const POSTS: RestoredPost[] = [

// ═══════════════════════════════════════════════════════════════
// 1. Best Engine Building Games (originally March 28)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'best-engine-building-games-of-all-time-2026-mna4xzpx',
  title: 'Best Engine Building Games of All Time (2026)',
  description: 'The most satisfying engine-building board games ranked. Build combos that get more powerful every turn.',
  tags: ['engine building', 'strategy', 'euro', 'ranked'],
  featured_game_ids: [],
  published_at: '2026-03-28T06:00:00Z',
  status: 'published',
  content: `Engine building is the mechanic that hooks people on board gaming for life. You start weak, build a system of interconnected parts, and by the final round your single action triggers a cascade of effects that would have been impossible at the start. That exponential growth is one of the most rewarding feelings in tabletop gaming.

Here are the best engine-building board games you can buy right now, from approachable gateways to deep strategic experiences.

## Wingspan

Designed by Elizabeth Hargrave and published in 2019, Wingspan made engine building accessible to millions. You place bird cards into three habitat rows, and each bird's ability triggers when you activate that habitat. As your rows fill up, each action chains through more and more birds.

The production quality is outstanding (custom egg miniatures, a bird feeder dice tower), and the 170+ unique bird cards with real species data give it educational value on top of great gameplay. Winner of the 2019 Kennerspiel des Jahres.

**Players**: 1-5. **Play time**: 40-70 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Wingspan+board+game&tag=boredgame-20)

## Terraforming Mars

Play project cards to raise oxygen, temperature, and ocean levels on Mars. Each card has a cost, a tag, and an effect. The magic is in the tag synergies: microbe cards boost each other, plant cards chain together, space cards reduce future space card costs.

With over 200 unique project cards, no two games play the same. The feeling of a well-tuned Terraforming Mars engine producing dozens of resources per round is peak engine building. Designed by Jacob Fryxelius, published in 2016.

**Players**: 1-5. **Play time**: 90-120 minutes. **Complexity**: 3.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Terraforming+Mars+board+game&tag=boredgame-20)

## Res Arcana

An engine builder distilled to its purest form. You draft a hand of just 8 artifact cards at the start, and that's your entire pool for the game. Over 4-6 rounds, you play artifacts that generate essences, convert essences into more powerful effects, and race to 10 points.

Games take 30 minutes, but the strategic density is comparable to games three times its length. Every card matters. Every resource decision matters. Designed by Tom Lehmann (of Race for the Galaxy fame).

**Players**: 2-4. **Play time**: 20-40 minutes. **Complexity**: 2.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Res+Arcana+board+game&tag=boredgame-20)

## Gizmos

A marble-dispensing machine sits in the center of the table. You draw marbles (energy) to pay for gizmo cards that give you new abilities. Some gizmos trigger when you pick a specific color marble. Others trigger when you build certain types. Chain enough triggers together and a single action cascades through five or six effects.

The marble machine is tactile and fun, and the chain reactions by the end are deeply satisfying. One of the best gateway engine builders for introducing new players to the concept.

**Players**: 2-4. **Play time**: 40-50 minutes. **Complexity**: 2.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Gizmos+board+game&tag=boredgame-20)

## Earth

The newest contender on this list. Released on Earth Day 2023 by Inside Up Games, Earth has over 400 unique cards and plays faster than Terraforming Mars while offering similar depth. You grow an island ecosystem, attracting fauna and planting flora through a satisfying card combination engine.

The simultaneous turns keep downtime low even at 5 players. If you love Wingspan but want something with more teeth, Earth is your next game.

**Players**: 1-5. **Play time**: 45-90 minutes. **Complexity**: 2.6/5.

[Check price on Amazon](https://www.amazon.com/s?k=Earth+board+game&tag=boredgame-20)

## The Engine-Building Spectrum

| Game | Complexity | Length | Best For |
|------|-----------|--------|----------|
| Gizmos | Low | 40 min | Gateway, chain reactions |
| Wingspan | Low-Medium | 50 min | Bird theme, cascading abilities |
| Res Arcana | Medium | 30 min | Tight card pool, experienced players |
| Earth | Medium | 60 min | Ecosystem combos, Wingspan fans |
| Terraforming Mars | Medium-High | 120 min | Deep card synergies, long sessions |

If you enjoy the feeling of your turns getting progressively more powerful, engine building is your mechanic. [Try our game finder](/find-a-game) to get personalized engine-building recommendations.`,
},

// ═══════════════════════════════════════════════════════════════
// 2. Simultaneous Action Games (originally March 29)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'top-simultaneous-action-games-for-zero-downtime-in-2026-mnbd9qal',
  title: 'Top Simultaneous Action Games for Zero Downtime in 2026',
  description: 'Board games where everyone plays at once. No waiting for turns, no checking your phone. Pure engagement.',
  tags: ['simultaneous action', 'no downtime', 'real-time', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-03-29T06:00:00Z',
  status: 'published',
  content: `The worst part of board gaming is waiting for your turn. Especially at higher player counts, watching someone agonize over their move for five minutes while you check your phone kills the energy. Simultaneous action games fix this completely. Everyone acts at the same time, so there's zero downtime.

## 7 Wonders

The game that proved simultaneous play could work in a strategy game. Everyone drafts a card from their hand at the same time, plays it, and passes the remaining cards. Three ages, seven wonders, and the whole thing wraps up in 30 minutes regardless of player count.

7 Wonders plays 2-7 people in the same amount of time. That's nearly unheard of for a game with this much strategic depth. Designed by Antoine Bauza, winner of the 2011 Kennerspiel des Jahres.

**Players**: 2-7. **Play time**: 30 minutes. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=7+Wonders+board+game&tag=boredgame-20)

## Galaxy Trucker

Build a spaceship out of sewer pipes and hope it survives. In the building phase, everyone simultaneously grabs tiles from a shared pool and adds them to their ship. Then you fly your janky creation through an obstacle course of meteors, pirates, and open space. Parts fall off. Crew members get lost. It's glorious chaos.

Galaxy Trucker is one of the funniest board games ever made. The simultaneous building phase creates frantic energy, and watching everyone's ships fall apart is consistently hilarious. Designed by Vlaada Chvatil.

**Players**: 2-4. **Play time**: 60 minutes. **Complexity**: 2.2/5.

[Check price on Amazon](https://www.amazon.com/s?k=Galaxy+Trucker+board+game&tag=boredgame-20)

## Between Two Cities

Each round, you draft tiles and simultaneously place them to build two cities, one shared with each neighbor. You score the lower of your two cities, which means you can't neglect either one. The negotiation with your neighbors about what to build where happens organically.

Between Two Cities plays 1-7 in about 25 minutes. The partnership mechanic creates interesting dynamics without complex rules. A great choice for larger groups.

**Players**: 1-7. **Play time**: 25 minutes. **Complexity**: 1.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Between+Two+Cities+board+game&tag=boredgame-20)

## KLASK

A dexterity game where you control a magnetic striker under the board to hit a ball into your opponent's goal. Both players act simultaneously in real time. Games last 5-10 minutes and are incredibly intense.

KLASK is one of the best games to have at a bar, party, or anywhere people gather. The table presence draws spectators, and the skill ceiling is high enough that competitive play exists. It's also rated on [BoardGameGeek](https://boardgamegeek.com/boardgame/165722/klask) with a 7.1.

**Players**: 2. **Play time**: 10 minutes. **Complexity**: 1.1/5.

[Check price on Amazon](https://www.amazon.com/s?k=KLASK+board+game&tag=boredgame-20)

## Sushi Go Party!

Everyone simultaneously picks a card from their hand and reveals at the same time. Simple, fast, and the cute sushi art makes it instantly appealing. The "Party" version lets you customize which sushi types appear each game.

**Players**: 2-8. **Play time**: 20 minutes. **Complexity**: 1.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Sushi+Go+Party+board+game&tag=boredgame-20)

## Why Simultaneous Play Matters

- **Scales without bloat**: 7 Wonders plays 7 people in the same time as 3
- **Constant engagement**: Nobody zones out because they're always doing something
- **Natural time pressure**: The social pressure of "everyone else is done" keeps turns snappy

If you hate downtime, [try our game finder](/find-a-game) and describe your group size. We'll match you with games where nobody waits.`,
},

// ═══════════════════════════════════════════════════════════════
// 3. Variable Player Power Games (originally March 30)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'top-variable-player-power-games-to-try-in-2026-mncstnnj',
  title: 'Top Variable Player Power Games to Try in 2026',
  description: 'Board games where every player has unique abilities. Asymmetric powers that make each seat at the table different.',
  tags: ['variable player powers', 'asymmetric', 'strategy', 'replayability'],
  featured_game_ids: [],
  published_at: '2026-03-30T06:00:00Z',
  status: 'published',
  content: `Variable player powers are the reason some games stay on shelves for years. When every player starts with unique abilities, each game feels different just by switching characters. You're not just replaying the same puzzle; you're approaching it from a completely different angle.

## Spirit Island

Each spirit on this island plays radically differently. A river spirit floods the land to redirect invaders. A lightning spirit strikes fast but burns out. A jungle spirit slowly overgrows settlements over many turns. With 8 spirits in the base game and more in expansions, the combinatorial space is enormous.

The asymmetry isn't cosmetic. Playing as Lightning's Swift Strike requires completely different strategic thinking than playing as A Spread of Rampant Green. This is the gold standard for variable player powers in cooperative games. Designed by R. Eric Reuss, published in 2017.

**Players**: 1-4. **Play time**: 90-120 minutes. **Complexity**: 4.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Spirit+Island+board+game&tag=boredgame-20)

## Root

A woodland war game where every faction plays by completely different rules. The Marquise de Cat builds and industrializes. The Eyrie Dynasties program actions on a decree that gets harder to maintain. The Woodland Alliance incites revolts. The Vagabond explores and makes deals.

Root is the most asymmetric competitive game you'll find. Each faction feels like it's playing a different game, yet they all interact in meaningful ways. It takes a few plays to understand all the factions, but the replayability is massive. Designed by Cole Wehrle.

**Players**: 2-4. **Play time**: 60-90 minutes. **Complexity**: 3.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Root+board+game&tag=boredgame-20)

## Cosmic Encounter

The granddaddy of variable powers. The Fantasy Flight edition (2008) includes 50 alien powers, each one breaking a fundamental rule of the game. One alien wins ties instead of losing them. Another can multiply their attack value. Another literally rearranges the discard pile at will.

Cosmic Encounter has been in print since 1977 for a reason. No other game creates the same "wait, you can DO that?" moments. The alien powers make every game feel like a different experience.

**Players**: 3-5. **Play time**: 60-90 minutes. **Complexity**: 2.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Cosmic+Encounter+board+game&tag=boredgame-20)

## Pandemic

Even a cooperative gateway game uses variable powers effectively. The Medic removes all cubes of one color at once. The Scientist needs fewer cards to cure. The Dispatcher can teleport other players. The Operations Expert can build research stations anywhere.

These roles aren't just flavor. They fundamentally change how your team approaches the shared puzzle. Designed by Matt Leacock, published in 2008.

**Players**: 2-4. **Play time**: 45 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Pandemic+board+game&tag=boredgame-20)

## Vast: The Crystal Caverns

Five players, five completely different games. The Knight explores the cave. The Dragon tries to wake up and escape. The Goblins set ambushes. The Cave itself tries to collapse on everyone. The Thief steals from everybody.

Vast is the most extreme asymmetry in board gaming. Teaching it requires explaining five different rule sets. But if your group embraces the chaos, it's an experience unlike anything else.

**Players**: 1-5. **Play time**: 75 minutes. **Complexity**: 3.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Vast+Crystal+Caverns+board+game&tag=boredgame-20)

## What Makes Good Variable Powers?

The best implementations share these traits:
- **Meaningfully different**, not just "+1 to combat" vs "+1 to resources"
- **Balanced enough** that no power feels broken after multiple plays
- **Easy to explain** without reading a full rulebook per character
- **Encourages replaying** by making you want to try every option

Looking for games with unique abilities? [Try our game finder](/find-a-game) and mention "asymmetric" or "variable powers" in your preferences.`,
},

// ═══════════════════════════════════════════════════════════════
// 4. Memory Games for Adults (originally March 31)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'memory-games-that-are-actually-fun-for-adults-in-2026-mne9dnnt',
  title: 'Memory Games That Are Actually Fun for Adults in 2026',
  description: 'Board games with memory mechanics that are genuinely engaging for adults, not just matching pairs.',
  tags: ['memory', 'family', 'adult games', 'mechanics'],
  featured_game_ids: [],
  published_at: '2026-03-31T06:00:00Z',
  status: 'published',
  content: `When most people hear "memory game," they think of flipping matching pairs of cards with a toddler. Fair enough. But memory as a game mechanic has evolved way beyond that. These games use hidden information, deduction, and recall in ways that make adults sweat.

## Mysterium

One player is a ghost, communicating through beautifully illustrated "vision" cards. The other players are psychic investigators trying to interpret those visions to identify a suspect, location, and weapon. The ghost can't speak. They can only hand out abstract art cards and hope the psychics connect the dots.

The memory element comes from tracking which clues the ghost has given over multiple rounds and piecing together patterns. It's cooperative, gorgeous, and creates memorable moments every game.

**Players**: 2-7. **Play time**: 40 minutes. **Complexity**: 1.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Mysterium+board+game&tag=boredgame-20)

## Hanabi

A cooperative card game where you can see everyone's hand except your own. Players give limited clues about each other's cards, and you have to remember what you've been told to play cards in the right order.

Hanabi won the 2013 Spiel des Jahres. The memory demands escalate as the game progresses. By the end, you're tracking what each player knows, what they don't know, and what their clue two rounds ago actually meant. Simple rules, brain-burning gameplay.

**Players**: 2-5. **Play time**: 25 minutes. **Complexity**: 1.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Hanabi+card+game&tag=boredgame-20)

## Cryptid

A deduction game where each player has one clue about where a cryptid is hiding on a modular map. On your turn, you ask another player to confirm or deny a location. The catch: you have to remember everyone's responses and cross-reference them to narrow down the answer.

Cryptid is pure logic puzzle with a memory layer. You're tracking four other players' deductions simultaneously. It's the rare game that makes you feel genuinely clever when you crack it.

**Players**: 3-5. **Play time**: 30-50 minutes. **Complexity**: 2.2/5.

[Check price on Amazon](https://www.amazon.com/s?k=Cryptid+board+game&tag=boredgame-20)

## Betrayal at House on the Hill

Explore a haunted house by flipping room tiles, collecting items, and triggering events. The house builds itself as you play, and you need to remember which rooms connect to what and where you left useful items. Then the Haunt happens, the traitor is revealed, and suddenly remembering the house layout becomes critical.

The memory element is organic. You're not memorizing for the sake of it; you're recalling a layout you helped build. The 50 unique haunts keep the game fresh across many plays.

**Players**: 3-6. **Play time**: 60 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Betrayal+at+House+on+the+Hill&tag=boredgame-20)

## Decrypto

Two teams each have four secret words. Each round, one player gives three clues to communicate a three-digit code. Your team needs to remember the clue patterns across multiple rounds, while the opposing team builds a dossier trying to crack your code.

The memory demands compound. By round four, you're recalling every clue from every round and looking for patterns. It's like Codenames but with a long-term memory arc.

**Players**: 3-8. **Play time**: 30 minutes. **Complexity**: 1.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Decrypto+board+game&tag=boredgame-20)

## Why Memory Mechanics Work for Adults

The best adult memory games don't test raw recall. They test:
- **Pattern recognition**: Connecting clues over time (Decrypto, Cryptid)
- **Spatial memory**: Remembering a layout (Betrayal)
- **Social deduction**: Tracking what people know (Hanabi)
- **Interpretation**: Recalling and reinterpreting abstract clues (Mysterium)

Want games that challenge your brain? [Try our game finder](/find-a-game) and tell it you like deduction and memory.`,
},

// ═══════════════════════════════════════════════════════════════
// 5. Trading Games (originally April 1)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'the-best-trading-games-of-2026-top-picks-reviewed-mnfn5wd5',
  title: 'The Best Trading Games of 2026: Top Picks Reviewed',
  description: 'Board games about trading, negotiation, and market manipulation. Buy low, sell high, ruin friendships.',
  tags: ['trading', 'negotiation', 'economic', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-04-01T06:00:00Z',
  status: 'published',
  content: `Trading in board games creates something no other mechanic can: genuine human negotiation. When you need wheat and your opponent needs brick, the conversation that follows is pure, unscripted social gameplay. No algorithm can replicate the feeling of pulling off a lopsided trade or watching someone realize they sold too cheap.

## Chinatown

The purest trading game ever made. You own businesses in 1960s New York's Chinatown district, and everything is negotiable. Tiles, money, businesses, future promises, anything. There are no restrictions on deals, and the game actively encourages creative trades.

Chinatown creates more wheeling and dealing per minute than any other game. "I'll give you my three connected bakery tiles if you give me $40,000 and that seafood restaurant." It's chaotic, social, and entirely driven by player negotiation. Published in 1999 by Karsten Hartwig.

**Players**: 3-5. **Play time**: 60 minutes. **Complexity**: 2.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Chinatown+board+game&tag=boredgame-20)

## Bohnanza

A bean trading card game where you must plant cards in the order you draw them. The only way to manage your hand is to trade beans with other players. This forces constant negotiation because everyone always has beans they don't want.

Bohnanza is brilliantly simple. The "no rearranging your hand" rule (you keep cards in draw order) creates genuine trading pressure. You need to trade, and so does everyone else. Designed by Uwe Rosenberg, published in 1997.

**Players**: 2-7. **Play time**: 45 minutes. **Complexity**: 1.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Bohnanza+card+game&tag=boredgame-20)

## Jaipur

A two-player trading game set in an Indian market. Collect and sell goods, balancing the risk of hoarding cards for bigger bonuses against your opponent snatching them first. The dynamic market (where taking cards refills from a common pool) creates constant tension.

A full game (best of three rounds) takes about 30 minutes. Designed by Sebastien Pauchon, released in 2009. One of the best trading games that works perfectly at two.

**Players**: 2. **Play time**: 30 minutes. **Complexity**: 1.5/5.

[Check price on Amazon](https://www.amazon.com/s?k=Jaipur+board+game&tag=boredgame-20)

## Concordia

A strategic trading game set in the Roman Mediterranean. You play cards to produce goods, trade at markets, and establish trading houses. Unlike Catan-style negotiation, Concordia's trading happens through game systems, not player-to-player bargaining.

If you want the economic satisfaction of trading without the social negotiation, Concordia delivers. The card-driven action system is one of the most elegant in all of board gaming. Designed by Mac Gerdts, published in 2013.

**Players**: 2-5. **Play time**: 90 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Concordia+board+game&tag=boredgame-20)

## For Sale

The best auction game at any length. Round one: bid on properties ranked 1-30. Round two: simultaneously sell those properties for checks. Total playtime: 15 minutes.

For Sale teaches you that overbidding kills you and holding your best cards too long is equally dangerous. Designed by Stefan Dorra, first published in 1997. Works with 3-6 players.

[Check price on Amazon](https://www.amazon.com/s?k=For+Sale+board+game&tag=boredgame-20)

## Two Types of Trading Games

**Negotiation-driven** (Chinatown, Bohnanza): The trading is the game. Human interaction drives everything.

**System-driven** (Concordia, Jaipur): Trading happens through game mechanics. Less social, more strategic.

Know which type you prefer? [Try our game finder](/find-a-game) and describe what you're looking for.`,
},

// ═══════════════════════════════════════════════════════════════
// 6. Modular Board Games (originally April 2)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'modular-board-games-that-are-different-every-time-mnh2lo0t',
  title: 'Modular Board Games That Are Different Every Time',
  description: 'Board games with modular setups that create a unique map every play. Maximum replayability built into the box.',
  tags: ['modular board', 'replayability', 'tile placement', 'variable setup'],
  featured_game_ids: [],
  published_at: '2026-04-02T06:00:00Z',
  status: 'published',
  content: `A modular board means the play surface is assembled differently each game. Instead of a fixed printed board, you lay out tiles, hexes, or cards that create a unique map. This single design choice transforms replayability because the geography changes your strategy every time.

## Catan

The game that introduced millions to modular boards. The island of Catan is built from 19 hexagonal terrain tiles shuffled and placed randomly, then numbered with production tokens. This means the wheat-rich region might be in the center one game and on the coast the next.

Catan's modular setup is the reason it's still played after 30 years. The variable board means optimal strategy shifts every game. Where you place your first settlement matters enormously, and the answer is different every time. Designed by Klaus Teuber, published in 1995.

**Players**: 3-4 (5-6 with expansion). **Play time**: 60-90 minutes. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Catan+board+game&tag=boredgame-20)

## Betrayal at House on the Hill

The haunted house literally builds itself as you explore. Each room is a tile drawn from a stack and placed adjacent to where you entered. By the end of the exploration phase, every group has created a completely unique house layout. Then the Haunt triggers and the map you built becomes the battlefield.

No two games of Betrayal look alike. The random room reveals create natural surprises ("oh great, the basement connects to a laboratory"), and the 50 different Haunt scenarios each use the house differently.

**Players**: 3-6. **Play time**: 60 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Betrayal+House+on+Hill+board+game&tag=boredgame-20)

## Eclipse: Second Dawn for the Galaxy

A 4X space game where the galaxy map is built from hex tiles as players explore outward from their home systems. Each tile might contain ancient aliens, wormholes, or valuable resources. The spatial politics of who borders whom creates different alliance dynamics every game.

Eclipse is the premium modular board experience. Games take 2-3 hours, but the galaxy you've built by the end feels earned. Designed by Touko Tahkokallio.

**Players**: 2-6. **Play time**: 120-180 minutes. **Complexity**: 3.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Eclipse+Second+Dawn+board+game&tag=boredgame-20)

## Carcassonne

The entire board is built tile by tile. On your turn, draw one tile and place it to extend the shared landscape. Cities grow, roads wind, and monasteries appear in unexpected places. The board at the end of a game is a unique medieval landscape that your group built together.

Carcassonne is the simplest modular board game and one of the most elegant. The tile-laying is the game. Designed by Klaus-Jurgen Wrede, published in 2000.

**Players**: 2-5. **Play time**: 30-45 minutes. **Complexity**: 1.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Carcassonne+board+game&tag=boredgame-20)

## Spirit Island

The island is built from modular land boards, one per player. The arrangement determines which spirits neighbor each other and how invader pressure flows. Different arrangements create different strategic challenges: coastal spirits need to be near the shore, but the modular setup doesn't guarantee it.

**Players**: 1-4. **Play time**: 90-120 minutes. **Complexity**: 4.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Spirit+Island+board+game&tag=boredgame-20)

## What Makes a Great Modular Board?

- **Meaningful layout changes**: The board arrangement should actually affect strategy, not just be cosmetic
- **Quick setup**: Modular doesn't have to mean 20 minutes of tile sorting
- **Exploration potential**: The best modular games reveal the board during play, not just at setup

Looking for games with high replayability? [Try our game finder](/find-a-game) and mention "modular" or "variable setup."`,
},

// ═══════════════════════════════════════════════════════════════
// 7. Programming Games (originally April 3)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'top-programming-games-where-you-plan-your-moves-2026-mnijd699',
  title: 'Top Programming Games Where You Plan Your Moves (2026)',
  description: 'Board games where you program actions in advance, then watch them play out. Plan carefully or crash spectacularly.',
  tags: ['programmed movement', 'planning', 'strategy', 'simultaneous'],
  featured_game_ids: [],
  published_at: '2026-04-03T06:00:00Z',
  status: 'published',
  content: `Programming games ask you to commit to actions before seeing what everyone else does. You lay down your moves, everyone reveals simultaneously, and then you watch your brilliant plan either work perfectly or collide hilariously with everyone else's choices. It's planning meets chaos.

## RoboRally

The original programming game. Each round, you play five movement cards (move forward, turn left, turn right, etc.) that your robot executes in order. The problem: conveyor belts shift your position, lasers damage you, and other robots bump you off course between your programmed steps.

RoboRally is responsible for more "NO NO NO" moments than almost any other game. You carefully plan a path, then one robot bumps you and suddenly you're walking off the edge of the board. Designed by Richard Garfield (yes, the Magic: The Gathering creator), published in 1994.

**Players**: 2-6. **Play time**: 45-120 minutes. **Complexity**: 2.1/5.

[Check price on Amazon](https://www.amazon.com/s?k=RoboRally+board+game&tag=boredgame-20)

## Mechs vs. Minions

A cooperative programming game set in the League of Legends universe. Your team of mechs programs movement and combat cards to fight waves of minions. The twist: cards stack on top of each other in your command line, and damage can scramble your programming.

The production quality is absurd (over 100 painted miniatures in the box), and the cooperative programming creates hilarious moments when someone's mech goes haywire. The 10-mission campaign escalates difficulty perfectly.

**Players**: 2-4. **Play time**: 60-90 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Mechs+vs+Minions+board+game&tag=boredgame-20)

## Colt Express

Program actions for your bandit in a 3D cardboard train. Move between cars, punch other bandits, grab loot, and dodge the marshal. Everyone's action cards are played into a shared deck, then resolved in order. The chaos of five bandits executing plans simultaneously on a moving train is pure fun.

Colt Express won the 2015 Spiel des Jahres. The 3D train is a visual centerpiece, and the game is accessible enough for families while being chaotic enough for gamers.

**Players**: 2-6. **Play time**: 30-40 minutes. **Complexity**: 1.8/5.

[Check price on Amazon](https://www.amazon.com/s?k=Colt+Express+board+game&tag=boredgame-20)

## Space Alert

A real-time cooperative game where you program a spaceship's crew to handle incoming threats. A 10-minute soundtrack plays, announcing threats, and you simultaneously place action cards on your crew's timeline. Then you resolve everything and see if your ship survived.

Space Alert is the most stressful 10 minutes in board gaming. The real-time element means you can't overthink. You just program and pray. Designed by Vlaada Chvatil.

**Players**: 1-5. **Play time**: 30 minutes. **Complexity**: 2.6/5.

[Check price on Amazon](https://www.amazon.com/s?k=Space+Alert+board+game&tag=boredgame-20)

## Why Programming Games Create Great Stories

Every programming game has a moment where someone's plan goes spectacularly wrong. Your robot walks into a pit. Your bandit punches thin air. Your spaceship fires lasers at empty space. These moments create stories your group retells for years.

The gap between "what I planned" and "what actually happened" is where the fun lives. If your group loves laughing at shared disasters, programming games are for you.

[Try our game finder](/find-a-game) for more games with programming mechanics.`,
},

// ═══════════════════════════════════════════════════════════════
// 8. Bag Building Games (originally April 4)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'top-games-with-bag-building-mechanics-in-2026-mnjxs863',
  title: 'Top Games with Bag Building Mechanics in 2026',
  description: 'The best bag-building board games where you draw tokens from a bag you customize. Deck building\'s tactile cousin.',
  tags: ['bag building', 'token drawing', 'push your luck', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-04-04T06:00:00Z',
  status: 'published',
  content: `Bag building is deck building's more tactile cousin. Instead of shuffling cards, you draw tokens from a physical bag. You add better tokens over the course of the game, improving your draws. The satisfying clatter of reaching into a bag and pulling out exactly what you needed (or didn't) creates moments that card shuffling can't match.

## Quacks of Quedlinburg

The game that made bag building mainstream. You're quack doctors brewing potions by drawing ingredient chips from your bag. Better ingredients score more points, but draw a white chip and your pot explodes. Each round you push your luck: do you draw one more chip or stop?

Quacks won the 2018 Kennerspiel des Jahres. The push-your-luck tension of each draw is electric. You can hear the groans across the table when someone's pot explodes one chip too late. Plays 2-4 in about 45 minutes.

**Players**: 2-4. **Play time**: 45 minutes. **Complexity**: 1.9/5.

[Check price on Amazon](https://www.amazon.com/s?k=Quacks+of+Quedlinburg+board+game&tag=boredgame-20)

## Orleans

A heavy strategy game where bag building drives worker placement. Each round, you draw workers from your bag and assign them to action spaces. As you add skilled workers (knights, scholars, craftsmen), your draws improve and your options expand.

Orleans uses bag building as the engine for a complex euro game. The tension of "I need a monk this round but my bag is full of farmers" creates real strategic pressure. Designed by Reiner Stockhausen, published in 2014.

**Players**: 2-4. **Play time**: 90 minutes. **Complexity**: 3.1/5.

[Check price on Amazon](https://www.amazon.com/s?k=Orleans+board+game&tag=boredgame-20)

## War Chest

An abstract strategy game where you draw unit coins from a bag to deploy and command forces on a grid. Each unit type moves differently, and your bag composition determines which units you can use each turn. Capturing control points wins the game.

War Chest is chess meets bag building. The randomness of the draw adds fog-of-war uncertainty to an otherwise pure strategy game. Beautifully produced with heavy custom coins. Plays best at 2 or 4 (teams).

**Players**: 2-4. **Play time**: 30 minutes. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=War+Chest+board+game&tag=boredgame-20)

## Automobiles

A racing game where bag building determines how far and fast your car moves. Draw cubes to accelerate, corner, and manage your engine. But wear-and-tear cubes clog your bag over time, so you need to pit stop to clear them out.

Automobiles makes the abstract bag-building mechanic concrete through its racing theme. The "my bag is full of junk" feeling maps perfectly to "my car needs a pit stop."

**Players**: 2-5. **Play time**: 45-75 minutes. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Automobiles+board+game+AEG&tag=boredgame-20)

## Bag Building vs. Deck Building

| Feature | Bag Building | Deck Building |
|---------|-------------|---------------|
| Randomness | Feel each draw physically | Shuffle and draw |
| Component quality | Chunky tokens, satisfying | Cards, sleevable |
| Transparency | Can't count exact contents easily | Can review discard pile |
| Setup | Faster (dump tokens in bag) | Shuffle multiple piles |
| Tactile feel | Much more satisfying | Standard |

Both mechanics scratch the "improve your engine" itch. Bag building just does it with your hands in a velvet pouch.

Curious about bag builders? [Try our game finder](/find-a-game) and filter by the bag building mechanic.`,
},

// ═══════════════════════════════════════════════════════════════
// 9. Rondel Games (originally April 5)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'rondel-games-explained-and-ranked-for-2026-mnldek92',
  title: 'Rondel Games Explained and Ranked for 2026',
  description: 'What is a rondel in board games? How the circular action selection mechanic works, plus the best rondel games ranked.',
  tags: ['rondel', 'action selection', 'euro', 'strategy'],
  featured_game_ids: [],
  published_at: '2026-04-05T06:00:00Z',
  status: 'published',
  content: `A rondel is a circular track of action spaces. On your turn, you move your marker a few spaces clockwise and take the action you land on. Want to skip ahead to a powerful action? You can, but it costs more. Want to keep revisiting the same cheap action? You can, but you'll miss out on the powerful ones.

This simple constraint creates deeply strategic decisions. The rondel limits your options in a way that feels like a puzzle, not a restriction.

## How Rondels Work

Picture a circle divided into 6-8 wedges, each showing a different action: produce, trade, build, recruit, research, etc. Your token sits on one wedge. Each turn, you move 1-3 spaces clockwise (free) or pay to move further.

The genius is in the spacing. If "produce" and "sell" are on opposite sides of the rondel, you can't do both on the same turn. You have to plan two or three turns ahead, timing your laps around the circle to chain actions efficiently.

## Concordia

While not a pure rondel game, Concordia uses a similar constraint through its card-based action system. You play cards to take actions, but you can only recover them all at once by "Tribune." This creates a rondel-like rhythm of building up actions and then resetting.

Concordia is one of the highest-rated strategy games on [BoardGameGeek](https://boardgamegeek.com/boardgame/124361/concordia). The elegance of the card system rivals any rondel for creating meaningful turn-to-turn planning. Designed by Mac Gerdts (who also designed several true rondel games).

**Players**: 2-5. **Play time**: 90 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Concordia+board+game&tag=boredgame-20)

## Imperial 2030

A geopolitical strategy game where you play as investors, not nations. You use a rondel to control major world powers, moving them through produce, tax, build, and maneuver actions. The twist: you can invest in any nation, so you might control multiple countries and play them against each other.

Imperial 2030 is Mac Gerdts' masterwork and the purest rondel experience. The geopolitical theme maps perfectly to the rondel's pacing, and the investor mechanic adds a layer of financial strategy on top.

**Players**: 2-6. **Play time**: 120-180 minutes. **Complexity**: 3.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Imperial+2030+board+game&tag=boredgame-20)

## Navegador

Explore the seas, build factories, colonize new lands, all driven by a rondel. Each action on the rondel has a clear purpose in the exploration/colonization loop, and the market system (where selling goods changes prices for everyone) adds economic depth.

Navegador is the most accessible of Mac Gerdts' rondel games. The exploration theme gives purpose to the circular action selection, making the mechanic intuitive for new players.

**Players**: 2-5. **Play time**: 60-90 minutes. **Complexity**: 2.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Navegador+board+game&tag=boredgame-20)

## Glen More II: Chronicles

Uses a rondel-like track where players take tiles from a market. The further ahead you reach on the track, the better the tile, but you skip your next turns. This creates a fascinating tempo game where patience is rewarded.

**Players**: 2-4. **Play time**: 60-90 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Glen+More+II+Chronicles+board+game&tag=boredgame-20)

## Who Should Try Rondel Games?

Rondel games appeal to players who enjoy:
- **Planning ahead**: You need to think 2-3 turns into the future
- **Efficiency puzzles**: Getting the most out of limited movement
- **Elegant design**: Rondels replace complex action menus with a simple circle
- **Low luck**: Most rondel games have zero randomness

If you like tight, strategic euro games, [try our game finder](/find-a-game) for rondel and action selection recommendations.`,
},

// ═══════════════════════════════════════════════════════════════
// 10. Combat-Focused Board Games (originally April 6)
// ═══════════════════════════════════════════════════════════════
{
  slug: 'top-combat-focused-board-games-to-play-in-2026-mnmtih2u',
  title: 'Top Combat-Focused Board Games to Play in 2026',
  description: 'The best board games centered on combat, from tactical skirmishes to epic war games. Fight it out on the tabletop.',
  tags: ['combat', 'war games', 'tactical', 'miniatures'],
  featured_game_ids: [],
  published_at: '2026-04-06T06:00:00Z',
  status: 'published',
  content: `Some board games are about building, trading, or cooperating. These are about fighting. Combat-focused board games put conflict at the center, whether it's tactical skirmishes between small squads or sweeping battles across continents. If you want a game where the primary interaction is "I attack you," this list is for you.

## Undaunted: Normandy

A two-player World War 2 tactical game that uses deck building for combat. You build a deck of soldier cards, and the cards you draw determine which units you can command. Moving, attacking, scouting, and controlling objectives all require playing the right cards.

The deck building creates fog of war naturally. You might want to attack with your riflemen, but if you drew all scouts this turn, you're scouting instead. The campaign links 12 scenarios into a connected narrative. Designed by David Thompson and Trevor Benjamin.

**Players**: 2. **Play time**: 45-60 minutes. **Complexity**: 2.4/5.

[Check price on Amazon](https://www.amazon.com/s?k=Undaunted+Normandy+board+game&tag=boredgame-20)

## Kemet: Blood and Sand

An area control game where turtling is impossible. The revised edition (Blood and Sand, 2021) rewards aggression through its combat system: attackers get more points than defenders, and retreating doesn't cost you much. This creates a game of constant warfare.

Kemet's power tiles let you customize your army with mythological creatures and god powers. Buy a giant scorpion. Summon a phoenix. The Egyptian mythology theme is baked into the mechanics, not just the art.

**Players**: 2-5. **Play time**: 90 minutes. **Complexity**: 3.0/5.

[Check price on Amazon](https://www.amazon.com/s?k=Kemet+Blood+and+Sand+board+game&tag=boredgame-20)

## Star Wars: Rebellion

An epic-scale game where the Rebel Alliance hides their base while the Galactic Empire hunts for it. The combat uses dice and cards representing fleet compositions. Star Destroyers clash with Rebel cruisers while Luke Skywalker goes on missions to sway systems.

Rebellion captures the feel of the original trilogy better than any other Star Wars game. The asymmetry (Empire has overwhelming force, Rebels have secrecy and heroes) creates incredible tension. Games run 3-4 hours and feel worth every minute.

**Players**: 2 (or 4 with teams). **Play time**: 180-240 minutes. **Complexity**: 3.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Star+Wars+Rebellion+board+game&tag=boredgame-20)

## Root

Already mentioned for its variable player powers, but Root deserves a combat spot too. Battles are simple (roll dice, compare hits), but the asymmetric factions create wildly different combat approaches. The Marquise overwhelms with numbers. The Eyrie attacks in disciplined patterns. The Woodland Alliance uses guerrilla warfare.

Root proves that combat doesn't need complex dice systems to be interesting. The faction asymmetry does the heavy lifting. Designed by Cole Wehrle.

**Players**: 2-4. **Play time**: 60-90 minutes. **Complexity**: 3.7/5.

[Check price on Amazon](https://www.amazon.com/s?k=Root+board+game&tag=boredgame-20)

## Memoir '44

A light war game using the Commands & Colors system. Play command cards to activate units in different sections of the battlefield, then roll custom dice for combat. The scenario-based design recreates historical World War 2 battles, from D-Day to the Battle of the Bulge.

Memoir '44 is the most accessible war game on this list. A single scenario plays in 30-60 minutes, and the over 100 official scenarios provide years of content. Great for introducing someone to tactical combat games.

**Players**: 2. **Play time**: 30-60 minutes. **Complexity**: 2.3/5.

[Check price on Amazon](https://www.amazon.com/s?k=Memoir+44+board+game&tag=boredgame-20)

## Combat Complexity Spectrum

| Game | Weight | Players | Time | Style |
|------|--------|---------|------|-------|
| Memoir '44 | Light | 2 | 45 min | Historical scenarios |
| Undaunted | Light-Medium | 2 | 50 min | Deck-building tactical |
| Root | Medium | 2-4 | 75 min | Asymmetric woodland war |
| Kemet | Medium | 2-5 | 90 min | Aggressive area control |
| Star Wars: Rebellion | Heavy | 2-4 | 3-4 hrs | Epic asymmetric conflict |

Want combat recommendations tailored to your group? [Try our game finder](/find-a-game) and tell it you want games focused on combat.`,
},

];

// ---------------------------------------------------------------------------
// Main: insert restored posts with game images and links
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Restoring ${POSTS.length} blog posts with original slugs and dates...`);

  const gameNames = [
    'Wingspan', 'Terraforming Mars', 'Res Arcana', 'Gizmos', 'Earth',
    '7 Wonders', 'Galaxy Trucker', 'Between Two Cities', 'KLASK', 'Sushi Go Party!',
    'Spirit Island', 'Root', 'Cosmic Encounter', 'Pandemic', 'Vast: The Crystal Caverns',
    'Mysterium', 'Hanabi', 'Cryptid', 'Betrayal at House on the Hill', 'Decrypto',
    'Chinatown', 'Bohnanza', 'Jaipur', 'Concordia', 'For Sale',
    'Catan', 'Carcassonne', 'Eclipse: Second Dawn for the Galaxy',
    'RoboRally', 'Mechs vs. Minions', 'Colt Express', 'Space Alert',
    'Quacks of Quedlinburg', 'Orleans', 'War Chest', 'Automobiles',
    'Imperial 2030', 'Navegador', 'Glen More II: Chronicles',
    'Undaunted: Normandy', 'Kemet: Blood and Sand', 'Star Wars: Rebellion',
    'Memoir \'44',
  ];

  console.log('Resolving game IDs and images...');
  const gameMap = new Map<string, GameInfo>();
  for (const name of gameNames) {
    const info = await findGame(name);
    if (info) gameMap.set(name, info);
  }
  console.log(`Found ${gameMap.size}/${gameNames.length} games in database.`);

  let inserted = 0;
  for (const post of POSTS) {
    // Check if slug already exists
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', post.slug)
      .single();

    if (existing) {
      console.log(`  ⏭ "${post.title}" (slug exists)`);
      continue;
    }

    let content = post.content;
    const featuredIds: string[] = [];

    for (const [name, info] of gameMap) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Add boredgame.lol link after Amazon links
      const amazonPattern = new RegExp(
        `(\\[Check price on Amazon\\]\\(https://www\\.amazon\\.com/s\\?k=[^)]*${escapedName.replace(/\s+/g, '\\+')}[^)]*\\))`,
        'i',
      );
      if (amazonPattern.test(content)) {
        content = content.replace(amazonPattern, (match) => {
          featuredIds.push(info.id);
          return match + ` | [View on boredgame.lol](/games/${encodeURIComponent(info.id)})`;
        });
      }

      // Add clickable game image after H2 headers
      if (info.image_url) {
        const headerPattern = new RegExp(`(## [^\\n]*${escapedName}[^\\n]*)\\n`, 'i');
        const firstMatch = content.match(headerPattern);
        if (firstMatch && firstMatch.index !== undefined) {
          const sizedUrl = info.image_url.replace('__original', '__imagepage');
          const gameUrl = `/games/${encodeURIComponent(info.id)}`;
          const imgTag = `<a href="${gameUrl}" target="_blank" rel="noopener"><img src="${sizedUrl}" alt="${name}" /></a>`;
          const before = content.slice(0, firstMatch.index);
          const after = content.slice(firstMatch.index + firstMatch[0].length);
          content = `${before}${firstMatch[1]}\n\n${imgTag}\n\n${after}`;
        }
      }
    }

    const gameIdMatches = content.matchAll(/\/games\/([a-zA-Z0-9_%-]+)/g);
    const allGameIds = [...new Set([...featuredIds, ...[...gameIdMatches].map((m) => decodeURIComponent(m[1]))])];

    const { error } = await supabase.from('blog_posts').insert({
      ...post,
      featured_game_ids: allGameIds.length > 0 ? allGameIds : post.featured_game_ids,
      content,
    });

    if (error) {
      console.error(`  ✗ "${post.title}": ${error.message}`);
    } else {
      inserted++;
      console.log(`  ✓ ${post.title} (${allGameIds.length} game links, published: ${post.published_at})`);
    }
  }

  console.log(`\nDone! Restored ${inserted}/${POSTS.length} posts.`);
}

main().catch(console.error);
