/**
 * Seed Collaborative Filtering Data
 *
 * Creates synthetic users representing distinct board game taste archetypes.
 * Each seed user has ratings on 20-40 well-known games, enabling collaborative
 * filtering to work immediately without waiting for organic user data.
 *
 * Usage: npx tsx scripts/seed-collaborative-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Generate stable UUIDs for seed users within a single run
const seedUserIds = new Map<string, string>();
function seedUserId(name: string): string {
  if (!seedUserIds.has(name)) {
    seedUserIds.set(name, randomUUID());
  }
  return seedUserIds.get(name)!;
}

// Well-known BGG game IDs (format: bgg-{bgg_id})
// These are the most popular/recognizable board games on BGG
const GAME_IDS = {
  // Heavy Strategy / Euro
  brass_birmingham: 'bgg-224517',
  terraforming_mars: 'bgg-167791',
  spirit_island: 'bgg-162886',
  gaia_project: 'bgg-220308',
  great_western_trail: 'bgg-193738',
  concordia: 'bgg-124361',
  agricola: 'bgg-31260',
  puerto_rico: 'bgg-3076',
  viticulture: 'bgg-183394',
  scythe: 'bgg-169786',
  orleans: 'bgg-164928',
  castles_of_burgundy: 'bgg-84876',
  feast_for_odin: 'bgg-177736',

  // Medium Weight / Gateway+
  wingspan: 'bgg-266192',
  azul: 'bgg-230802',
  everdell: 'bgg-199792',
  parks: 'bgg-266524',
  root: 'bgg-237182',
  clank: 'bgg-201808',
  quacks: 'bgg-244521',
  cascadia: 'bgg-295947',
  arnak: 'bgg-312484',

  // Gateway / Family
  catan: 'bgg-13',
  ticket_to_ride: 'bgg-9209',
  carcassonne: 'bgg-822',
  dominion: 'bgg-36218',
  pandemic: 'bgg-30549',
  splendor: 'bgg-148228',
  seven_wonders: 'bgg-68448',
  king_of_tokyo: 'bgg-70323',
  dixit: 'bgg-39856',

  // Party / Social
  codenames: 'bgg-178900',
  wavelength: 'bgg-262543',
  just_one: 'bgg-254640',
  the_crew: 'bgg-284083',
  sushi_go: 'bgg-133473',
  love_letter: 'bgg-129622',
  coup: 'bgg-131357',
  skulls: 'bgg-92415',
  secret_hitler: 'bgg-188834',
  telestrations: 'bgg-46213',

  // Co-op
  gloomhaven: 'bgg-174430',
  arkham_horror_lcg: 'bgg-205637',
  robinson_crusoe: 'bgg-121921',
  forbidden_island: 'bgg-65244',
  hanabi: 'bgg-98778',
  marvel_champions: 'bgg-285774',

  // Dungeon Crawl / Thematic
  mage_knight: 'bgg-96848',
  descent: 'bgg-104162',
  mansions_of_madness: 'bgg-205059',
  betrayal: 'bgg-10547',
  zombicide: 'bgg-113924',

  // Deck Building
  star_realms: 'bgg-147020',
  marvel_legendary: 'bgg-129437',
  aeons_end: 'bgg-191189',

  // Abstract
  hive: 'bgg-2655',
  patchwork: 'bgg-163412',
  santorini: 'bgg-194655',

  // War / Area Control
  war_of_the_ring: 'bgg-115746',
  twilight_struggle: 'bgg-12333',
  risk_legacy: 'bgg-105134',
  inis: 'bgg-155821',
  blood_rage: 'bgg-170216',
  kemet: 'bgg-127023',
};

// Taste archetypes with game ratings
interface SeedUser {
  name: string;
  ratings: Record<string, number>; // game key -> rating (1-10)
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'heavy-euro-strategist',
    ratings: {
      brass_birmingham: 10, terraforming_mars: 9, gaia_project: 9, spirit_island: 9,
      great_western_trail: 9, concordia: 8, agricola: 8, puerto_rico: 8,
      feast_for_odin: 9, scythe: 7, castles_of_burgundy: 8, viticulture: 7,
      orleans: 8, root: 7, wingspan: 5, catan: 3, king_of_tokyo: 2,
      codenames: 4, pandemic: 5, ticket_to_ride: 3,
    },
  },
  {
    name: 'gateway-family-gamer',
    ratings: {
      catan: 9, ticket_to_ride: 10, carcassonne: 8, azul: 9, wingspan: 9,
      splendor: 8, seven_wonders: 7, cascadia: 9, dixit: 7, pandemic: 8,
      king_of_tokyo: 8, parks: 8, codenames: 7, dominion: 6,
      brass_birmingham: 3, gaia_project: 2, agricola: 3, spirit_island: 4,
      mage_knight: 1, war_of_the_ring: 2,
    },
  },
  {
    name: 'party-game-enthusiast',
    ratings: {
      codenames: 10, wavelength: 9, just_one: 9, telestrations: 8,
      dixit: 8, skulls: 8, secret_hitler: 9, coup: 7, love_letter: 7,
      sushi_go: 8, king_of_tokyo: 7, the_crew: 7,
      brass_birmingham: 2, terraforming_mars: 3, agricola: 2,
      gaia_project: 1, mage_knight: 1, twilight_struggle: 2,
      spirit_island: 3, gloomhaven: 3,
    },
  },
  {
    name: 'coop-lover',
    ratings: {
      spirit_island: 10, pandemic: 9, gloomhaven: 10, arkham_horror_lcg: 9,
      robinson_crusoe: 8, hanabi: 7, forbidden_island: 7, the_crew: 9,
      marvel_champions: 8, aeons_end: 8, mansions_of_madness: 7,
      root: 6, wingspan: 7, azul: 5,
      secret_hitler: 4, coup: 3, risk_legacy: 2, blood_rage: 4,
    },
  },
  {
    name: 'dungeon-crawler',
    ratings: {
      gloomhaven: 10, mage_knight: 9, descent: 8, mansions_of_madness: 8,
      betrayal: 7, zombicide: 7, arkham_horror_lcg: 9, spirit_island: 8,
      robinson_crusoe: 7, marvel_champions: 7, war_of_the_ring: 8,
      root: 7, blood_rage: 7, kemet: 6,
      azul: 3, ticket_to_ride: 2, codenames: 3, just_one: 2,
    },
  },
  {
    name: 'quick-filler-fan',
    ratings: {
      love_letter: 9, coup: 9, sushi_go: 9, the_crew: 10, hanabi: 8,
      star_realms: 9, skulls: 8, hive: 8, patchwork: 9, codenames: 7,
      king_of_tokyo: 7, azul: 8, splendor: 7, santorini: 8,
      gloomhaven: 3, brass_birmingham: 2, feast_for_odin: 2,
      war_of_the_ring: 1, mage_knight: 2, gaia_project: 2,
    },
  },
  {
    name: 'deck-builder-addict',
    ratings: {
      dominion: 10, star_realms: 9, clank: 9, aeons_end: 9,
      marvel_legendary: 8, the_crew: 7, arnak: 9, quacks: 8,
      terraforming_mars: 7, spirit_island: 7, wingspan: 6,
      root: 6, everdell: 7, seven_wonders: 7,
      catan: 4, ticket_to_ride: 3, dixit: 3, telestrations: 2,
    },
  },
  {
    name: 'area-control-warmonger',
    ratings: {
      root: 10, war_of_the_ring: 10, twilight_struggle: 9, blood_rage: 9,
      inis: 9, kemet: 8, risk_legacy: 7, scythe: 8,
      great_western_trail: 7, brass_birmingham: 7, spirit_island: 6,
      mage_knight: 8, concordia: 6,
      codenames: 3, dixit: 2, just_one: 2, love_letter: 3,
      ticket_to_ride: 3, azul: 4,
    },
  },
  {
    name: 'two-player-specialist',
    ratings: {
      patchwork: 10, hive: 9, star_realms: 9, twilight_struggle: 9,
      war_of_the_ring: 8, santorini: 8, the_crew: 8, love_letter: 7,
      seven_wonders: 7, castles_of_burgundy: 8, concordia: 7,
      spirit_island: 8, arkham_horror_lcg: 7, wingspan: 7,
      codenames: 5, secret_hitler: 3, telestrations: 2,
    },
  },
  {
    name: 'midweight-enthusiast',
    ratings: {
      everdell: 10, wingspan: 9, arnak: 9, root: 9, clank: 8,
      quacks: 8, parks: 8, cascadia: 9, azul: 8, viticulture: 8,
      scythe: 8, seven_wonders: 7, splendor: 7, dominion: 7,
      brass_birmingham: 6, gaia_project: 5, agricola: 5,
      love_letter: 5, coup: 5, telestrations: 3,
    },
  },
  {
    name: 'narrative-gamer',
    ratings: {
      gloomhaven: 9, arkham_horror_lcg: 10, mansions_of_madness: 9,
      betrayal: 8, robinson_crusoe: 8, spirit_island: 8,
      mage_knight: 7, descent: 7, root: 7, marvel_champions: 8,
      everdell: 7, scythe: 7, war_of_the_ring: 8,
      azul: 4, splendor: 3, hive: 3, patchwork: 4,
      codenames: 4, sushi_go: 3,
    },
  },
  {
    name: 'abstract-thinker',
    ratings: {
      hive: 10, santorini: 9, patchwork: 9, azul: 9,
      castles_of_burgundy: 8, seven_wonders: 7, splendor: 8,
      concordia: 8, puerto_rico: 7, gaia_project: 7,
      brass_birmingham: 7, agricola: 6, carcassonne: 7,
      betrayal: 2, zombicide: 2, secret_hitler: 3,
      codenames: 4, telestrations: 2, king_of_tokyo: 3,
    },
  },
  {
    name: 'social-deduction-lover',
    ratings: {
      secret_hitler: 10, coup: 9, skulls: 9, codenames: 8,
      wavelength: 8, love_letter: 7, betrayal: 7,
      the_crew: 7, just_one: 7, dixit: 7,
      root: 6, blood_rage: 5, inis: 5,
      brass_birmingham: 2, gaia_project: 1, agricola: 2,
      terraforming_mars: 3, mage_knight: 1, feast_for_odin: 1,
    },
  },
  {
    name: 'engine-builder',
    ratings: {
      terraforming_mars: 10, wingspan: 9, everdell: 9, viticulture: 8,
      great_western_trail: 9, orleans: 8, concordia: 8,
      castles_of_burgundy: 8, scythe: 8, arnak: 8,
      splendor: 7, parks: 7, cascadia: 7,
      coup: 3, secret_hitler: 3, love_letter: 3,
      codenames: 4, telestrations: 2, skulls: 3,
    },
  },
  {
    name: 'worker-placement-fan',
    ratings: {
      agricola: 10, viticulture: 9, feast_for_odin: 9, orleans: 8,
      great_western_trail: 8, everdell: 8, arnak: 8,
      castles_of_burgundy: 7, concordia: 7, scythe: 7,
      terraforming_mars: 7, spirit_island: 6, wingspan: 7,
      codenames: 3, coup: 3, love_letter: 3,
      secret_hitler: 2, telestrations: 2, king_of_tokyo: 4,
    },
  },
  {
    name: 'casual-cozy-gamer',
    ratings: {
      cascadia: 10, parks: 9, wingspan: 9, azul: 9,
      patchwork: 8, carcassonne: 8, dixit: 8,
      ticket_to_ride: 8, splendor: 8, everdell: 8,
      forbidden_island: 7, just_one: 7, sushi_go: 7,
      gloomhaven: 2, mage_knight: 1, war_of_the_ring: 1,
      twilight_struggle: 2, agricola: 3, brass_birmingham: 2,
    },
  },
  {
    name: 'competitive-optimizer',
    ratings: {
      brass_birmingham: 10, gaia_project: 9, puerto_rico: 9,
      great_western_trail: 9, agricola: 8, concordia: 8,
      terraforming_mars: 8, root: 8, blood_rage: 7,
      kemet: 7, inis: 7, twilight_struggle: 8,
      scythe: 7, castles_of_burgundy: 7,
      pandemic: 3, forbidden_island: 2, hanabi: 4,
      dixit: 2, telestrations: 1, just_one: 3,
    },
  },
  {
    name: 'tile-layer-collector',
    ratings: {
      azul: 10, carcassonne: 9, cascadia: 9, patchwork: 9,
      castles_of_burgundy: 8, parks: 8, everdell: 7,
      wingspan: 8, splendor: 7, ticket_to_ride: 7,
      seven_wonders: 7, quacks: 7, dominion: 6,
      gloomhaven: 3, mage_knight: 2, war_of_the_ring: 2,
      secret_hitler: 3, coup: 4, blood_rage: 3,
    },
  },
  {
    name: 'legacy-campaign-addict',
    ratings: {
      gloomhaven: 10, pandemic: 8, risk_legacy: 8,
      arkham_horror_lcg: 9, betrayal: 7, robinson_crusoe: 7,
      spirit_island: 8, mage_knight: 7, descent: 7,
      clank: 7, root: 7, scythe: 7,
      marvel_champions: 8, aeons_end: 7,
      azul: 4, hive: 3, patchwork: 3,
      sushi_go: 3, love_letter: 3,
    },
  },
  {
    name: 'trick-taking-cardist',
    ratings: {
      the_crew: 10, hanabi: 8, love_letter: 8,
      sushi_go: 7, coup: 7, star_realms: 7,
      seven_wonders: 7, dominion: 8, splendor: 6,
      codenames: 6, skulls: 7, secret_hitler: 6,
      azul: 6, patchwork: 6, cascadia: 6,
      gloomhaven: 3, mage_knight: 2, war_of_the_ring: 2,
      gaia_project: 2, feast_for_odin: 2,
    },
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let totalFeedback = 0;

  for (const user of SEED_USERS) {
    const userId = seedUserId(user.name);
    console.log(`\nSeeding: ${user.name} (${userId})`);

    // Create auth user (service role can do this)
    const email = `seed_${user.name}@boredgame.internal`;
    await supabase.auth.admin.createUser({
      email,
      password: `seed-${user.name}-${Date.now()}`,
      user_metadata: { display_name: `Seed: ${user.name}` },
      email_confirm: true,
    }).catch(() => {
      // User might already exist, that's fine
    });

    // Build feedback rows
    const feedbackRows: { user_id: string; game_id: string; rating: number }[] = [];

    for (const [gameKey, rating] of Object.entries(user.ratings)) {
      const gameId = GAME_IDS[gameKey as keyof typeof GAME_IDS];
      if (!gameId) {
        console.warn(`  Unknown game key: ${gameKey}`);
        continue;
      }

      // Check if game exists in DB
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('id', gameId)
        .single();

      if (!game) {
        console.warn(`  Game not in DB: ${gameKey} (${gameId})`);
        continue;
      }

      // Convert 1-10 rating to feedback: >= 7 positive, <= 4 negative
      if (rating >= 7) {
        feedbackRows.push({ user_id: userId, game_id: gameId, rating: 1 });
      } else if (rating <= 4) {
        feedbackRows.push({ user_id: userId, game_id: gameId, rating: -1 });
      }
    }

    if (feedbackRows.length > 0) {
      const { error } = await supabase
        .from('user_game_feedback')
        .upsert(feedbackRows, { onConflict: 'user_id,game_id' });

      if (error) {
        console.error(`  Error inserting feedback: ${error.message}`);
      } else {
        console.log(`  Inserted ${feedbackRows.length} feedback entries`);
        totalFeedback += feedbackRows.length;
      }
    }
  }

  console.log(`\nDone! Seeded ${SEED_USERS.length} users with ${totalFeedback} total feedback entries.`);
}

main().catch(console.error);
