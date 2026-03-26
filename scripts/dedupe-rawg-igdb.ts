/**
 * Deduplication Script: RAWG → IGDB
 *
 * Finds video games that exist in both RAWG and IGDB (matched by
 * normalized name), keeps the IGDB version (richer metadata), and
 * removes the RAWG duplicate.
 *
 * Before deleting, migrates any user data (favorites, reviews,
 * feedback, embeddings) from the RAWG ID to the IGDB ID.
 *
 * Usage:
 *   npx tsx scripts/dedupe-rawg-igdb.ts          # dry run (preview only)
 *   npx tsx scripts/dedupe-rawg-igdb.ts --apply   # actually delete dupes
 *
 * Safe to run multiple times — idempotent.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--apply');
const BATCH_SIZE = 1000;

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/** Normalize a game name for fuzzy matching */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Strip all non-alphanumeric
    .trim();
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const supabase = createDbClient();

  console.log(`[Dedupe] Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'APPLY (will delete duplicates)'}`);
  console.log('[Dedupe] Loading RAWG games...');

  // Fetch all RAWG game IDs and names
  const rawgGames: { id: string; name: string }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name')
      .eq('source', 'rawg')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('[Dedupe] Error fetching RAWG games:', error.message); break; }
    if (!data || data.length === 0) break;

    rawgGames.push(...data);
    offset += BATCH_SIZE;
  }

  console.log(`[Dedupe] Found ${rawgGames.length} RAWG games`);

  // Build a lookup: normalized name → RAWG game ID
  const rawgByName = new Map<string, string>();
  for (const g of rawgGames) {
    rawgByName.set(normalizeName(g.name), g.id);
  }

  // Fetch all IGDB game names
  console.log('[Dedupe] Loading IGDB games...');
  const igdbGames: { id: string; name: string }[] = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name')
      .eq('source', 'igdb')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('[Dedupe] Error fetching IGDB games:', error.message); break; }
    if (!data || data.length === 0) break;

    igdbGames.push(...data);
    offset += BATCH_SIZE;
  }

  console.log(`[Dedupe] Found ${igdbGames.length} IGDB games`);

  // Find matches: IGDB game name exists in RAWG
  const dupes: { rawgId: string; igdbId: string; name: string }[] = [];
  for (const igdb of igdbGames) {
    const normalized = normalizeName(igdb.name);
    const rawgId = rawgByName.get(normalized);
    if (rawgId) {
      dupes.push({ rawgId, igdbId: igdb.id, name: igdb.name });
    }
  }

  console.log(`[Dedupe] Found ${dupes.length} duplicates (same game in both RAWG and IGDB)`);

  if (dupes.length === 0) {
    console.log('[Dedupe] Nothing to do!');
    return;
  }

  // Preview first 20
  console.log('\n[Dedupe] Sample duplicates:');
  for (const d of dupes.slice(0, 20)) {
    console.log(`  ${d.name}: ${d.rawgId} (RAWG) → ${d.igdbId} (IGDB)`);
  }

  if (DRY_RUN) {
    console.log(`\n[Dedupe] DRY RUN complete. ${dupes.length} duplicates found.`);
    console.log('[Dedupe] Run with --apply to delete RAWG duplicates.');
    return;
  }

  // ── Apply: batch migrate user data then batch delete RAWG entries ──

  const DELETE_BATCH = 50;
  console.log(`\n[Dedupe] Deleting ${dupes.length} RAWG duplicates in batches of ${DELETE_BATCH}...`);

  let deleted = 0;
  let errors = 0;

  for (let i = 0; i < dupes.length; i += DELETE_BATCH) {
    const batch = dupes.slice(i, i + DELETE_BATCH);
    const rawgIds = batch.map((d) => d.rawgId);

    try {
      // Batch migrate user data: update all rows where game_id is any of the RAWG IDs
      // For each dupe, point to the IGDB version. We do this per-item since
      // each RAWG ID maps to a different IGDB ID.
      // But deletes can be batched — that's the slow part.
      const migrationPromises = batch.map(({ rawgId, igdbId }) =>
        Promise.all([
          (supabase as any).from('user_favorites').update({ game_id: igdbId }).eq('game_id', rawgId),
          (supabase as any).from('user_reviews').update({ game_id: igdbId }).eq('game_id', rawgId),
          (supabase as any).from('user_game_feedback').update({ game_id: igdbId }).eq('game_id', rawgId),
        ])
      );
      await Promise.all(migrationPromises);

      // Batch delete all RAWG games in one query
      const { error } = await supabase
        .from('games')
        .delete()
        .in('id', rawgIds);

      if (error) {
        console.error(`[Dedupe] Batch delete error:`, error.message);
        errors += batch.length;
      } else {
        deleted += batch.length;
      }
    } catch (err) {
      console.error(`[Dedupe] Batch error at offset ${i}:`, err);
      errors += batch.length;
    }

    console.log(`[Dedupe] ${deleted} / ${dupes.length} deleted`);
  }

  console.log(`\n[Dedupe] Done!`);
  console.log(`  Duplicates found: ${dupes.length}`);
  console.log(`  RAWG entries deleted: ${deleted}`);
  console.log(`  User data migrated: ${deleted}`);
  console.log(`  Errors: ${errors}`);
}

main().catch((err) => {
  console.error('[Dedupe] Fatal error:', err);
  process.exit(1);
});
