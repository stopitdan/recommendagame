/**
 * Seed Test Data
 *
 * Creates test users with `test_123_` prefixed emails and populates
 * them with favorites, reviews, and presets for development/testing.
 *
 * All test users use the password: TestPassword123!
 * All test emails follow: test_123_{name}@recommendagame.test
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 *
 * Cleanup:
 *   npx tsx scripts/seed-test-data.ts --cleanup
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const TEST_PASSWORD = 'TestPassword123!';

const TEST_USERS = [
  { name: 'alice', displayName: 'Alice the Strategist', preferences: { genres: ['Strategy', 'Fantasy'], moods: ['brain-teaser', 'competitive'] } },
  { name: 'bob', displayName: 'Bob the Partier', preferences: { genres: ['Party', 'Trivia'], moods: ['social', 'chill'] } },
  { name: 'carol', displayName: 'Carol the Gamer', preferences: { genres: ['RPG', 'Adventure', 'Action'], moods: ['story-driven', 'competitive'] } },
  { name: 'dave', displayName: 'Dave the Casual', preferences: { genres: ['Family', 'Puzzle'], moods: ['chill', 'cooperative'] } },
  { name: 'eve', displayName: 'Eve the Explorer', preferences: { genres: ['Adventure', 'Sci-Fi', 'Horror'], moods: ['story-driven', 'brain-teaser'] } },
];

function email(name: string) {
  return `test_123_${name}@recommendagame.test`;
}

async function getRandomGames(count: number, source?: string) {
  let query = supabase
    .from('games')
    .select('id, name')
    .not('rating', 'is', null)
    .gte('rating_count', 50)
    .order('rating', { ascending: false })
    .limit(200);

  if (source) query = query.eq('source', source);

  const { data } = await query;
  if (!data || data.length === 0) return [];

  // Shuffle and take N
  const shuffled = data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function seedUsers() {
  console.log('[Seed] Creating test users...\n');

  for (const user of TEST_USERS) {
    const userEmail = email(user.name);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  [${user.name}] Already exists, skipping creation`);
        // Get the existing user
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users?.find((u) => u.email === userEmail);
        if (!existing) continue;
        await seedUserData(existing.id, user);
      } else {
        console.error(`  [${user.name}] Error:`, authError.message);
      }
      continue;
    }

    if (!authData.user) continue;
    console.log(`  [${user.name}] Created: ${userEmail}`);

    // Create profile
    await supabase.from('user_profiles').upsert({
      id: authData.user.id,
      display_name: user.displayName,
    });

    await seedUserData(authData.user.id, user);
  }
}

async function seedUserData(userId: string, user: typeof TEST_USERS[0]) {
  // Get random games for favorites and reviews
  const games = await getRandomGames(15);
  if (games.length === 0) {
    console.log(`  [${user.name}] No games found, skipping data`);
    return;
  }

  // Favorites (first 8 games)
  const favoriteGames = games.slice(0, 8);
  for (const game of favoriteGames) {
    await supabase.from('user_favorites').upsert(
      { user_id: userId, game_id: game.id },
      { onConflict: 'user_id,game_id' },
    );
  }
  console.log(`  [${user.name}] Added ${favoriteGames.length} favorites`);

  // Reviews (10 games with varied ratings)
  const reviewGames = games.slice(0, 10);
  const reviewTexts = [
    'Absolutely loved this! Great with friends.',
    'Solid game, would play again.',
    'Not my cup of tea, but well-made.',
    'Amazing depth and replayability.',
    'Perfect for game night.',
    'A bit too complex for casual play.',
    'Hidden gem! More people should know about this.',
    'Classic for a reason.',
    null, // Some reviews have no text
    null,
  ];

  for (let i = 0; i < reviewGames.length; i++) {
    const rating = Math.min(10, Math.max(1, Math.round(5 + Math.random() * 5))); // 5-10 mostly
    await supabase.from('user_reviews').upsert(
      {
        user_id: userId,
        game_id: reviewGames[i].id,
        rating,
        review_text: reviewTexts[i],
      },
      { onConflict: 'user_id,game_id' },
    );
  }
  console.log(`  [${user.name}] Added ${reviewGames.length} reviews`);

  // Presets (2 per user)
  const presets = [
    {
      name: `${user.displayName}'s Game Night`,
      preferences: {
        gameType: 'board',
        playerCount: { min: 3, max: 6 },
        timeAvailable: 'medium',
        complexity: { min: 2, max: 4 },
        genres: user.preferences.genres,
        moods: user.preferences.moods,
        freeText: '',
      },
    },
    {
      name: `Quick ${user.preferences.genres[0]} Session`,
      preferences: {
        gameType: null,
        playerCount: { min: 2, max: 4 },
        timeAvailable: 'short',
        complexity: { min: 1, max: 3 },
        genres: [user.preferences.genres[0]],
        moods: [user.preferences.moods[0]],
        freeText: '',
      },
    },
  ];

  for (const preset of presets) {
    // Check if preset already exists
    const { data: existing } = await supabase
      .from('user_saved_presets')
      .select('id')
      .eq('user_id', userId)
      .eq('name', preset.name)
      .single();

    if (!existing) {
      await supabase.from('user_saved_presets').insert({
        user_id: userId,
        name: preset.name,
        preferences: preset.preferences,
      });
    }
  }
  console.log(`  [${user.name}] Added ${presets.length} presets`);
}

async function cleanup() {
  console.log('[Cleanup] Removing test users...\n');

  const { data: { users } } = await supabase.auth.admin.listUsers();
  const testUsers = users?.filter((u) => u.email?.startsWith('test_123_')) ?? [];

  for (const user of testUsers) {
    // Cascade deletes handle favorites, reviews, presets, preferences
    await supabase.auth.admin.deleteUser(user.id);
    console.log(`  Deleted: ${user.email}`);
  }

  console.log(`\n[Cleanup] Removed ${testUsers.length} test users`);
}

async function main() {
  if (process.argv.includes('--cleanup')) {
    await cleanup();
  } else {
    await seedUsers();
    console.log('\n[Seed] Done! All test users created with data.');
    console.log('Password for all test users:', TEST_PASSWORD);
  }
}

main().catch(console.error);
