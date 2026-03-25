/**
 * BGG Kaggle Dataset Importer
 *
 * Imports the Kaggle BGG dataset (22k board games) into Supabase.
 * Reads games.csv + mechanics.csv + themes.csv + subcategories.csv +
 * designers_reduced.csv + publishers_reduced.csv and joins them together.
 *
 * Usage: npx tsx scripts/import-bgg-kaggle.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_DIR = resolve('data/bgg-dataset-2026-03-25');
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function parseFloat_(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseInt_(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function parseRank(v: string | undefined): number | null {
  if (!v || v === '' || v === 'Not Ranked') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// CSV Reader (binary-flag columns → array of names)
// ---------------------------------------------------------------------------

/**
 * Reads a binary-flag CSV (like mechanics.csv) and returns a map of
 * BGGId → array of column names where the flag is 1.
 */
async function readBinaryFlagCsv(filename: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  return new Promise((resolve, reject) => {
    const records: any[] = [];
    let headers: string[] = [];

    createReadStream(`${DATA_DIR}/${filename}`)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }))
      .on('data', (row: any) => {
        const bggId = row['BGGId'];
        if (!bggId) return;

        const values: string[] = [];
        for (const [key, val] of Object.entries(row)) {
          if (key === 'BGGId') continue;
          if (val === '1') values.push(key);
        }

        if (values.length > 0) {
          map.set(bggId, values);
        }
      })
      .on('end', () => resolve(map))
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main Import
// ---------------------------------------------------------------------------

async function importGames() {
  console.log(`[${timestamp()}] [BGG Import] Loading supporting tables...`);

  // Load mechanics, themes, subcategories, designers, publishers in parallel
  const [mechanicsMap, themesMap, subcategoriesMap, designersMap, publishersMap] = await Promise.all([
    readBinaryFlagCsv('mechanics.csv'),
    readBinaryFlagCsv('themes.csv'),
    readBinaryFlagCsv('subcategories.csv'),
    readBinaryFlagCsv('designers_reduced.csv'),
    readBinaryFlagCsv('publishers_reduced.csv'),
  ]);

  console.log(`[${timestamp()}] Loaded: ${mechanicsMap.size} mechanics, ${themesMap.size} themes, ${subcategoriesMap.size} subcategories, ${designersMap.size} designers, ${publishersMap.size} publishers`);

  // Read games.csv and build rows
  console.log(`[${timestamp()}] [BGG Import] Reading games.csv...`);

  const rows: any[] = [];

  await new Promise<void>((resolve, reject) => {
    createReadStream(`${DATA_DIR}/games.csv`)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }))
      .on('data', (game: any) => {
        const bggId = game['BGGId'];
        if (!bggId) return;

        // Build categories from the Cat:* binary columns + subcategories
        const categories: string[] = [];
        if (game['Cat:Thematic'] === '1') categories.push('Thematic');
        if (game['Cat:Strategy'] === '1') categories.push('Strategy');
        if (game['Cat:War'] === '1') categories.push('War');
        if (game['Cat:Family'] === '1') categories.push('Family');
        if (game['Cat:CGS'] === '1') categories.push('Card Game');
        if (game['Cat:Abstract'] === '1') categories.push('Abstract');
        if (game['Cat:Party'] === '1') categories.push('Party');
        if (game['Cat:Childrens'] === '1') categories.push('Children');

        // Add subcategories
        const subs = subcategoriesMap.get(bggId) ?? [];
        categories.push(...subs);

        // Determine types
        const types: string[] = ['board'];
        if (game['Cat:Party'] === '1') types.push('party');
        if (subs.includes('Card Game')) types.push('card');
        if (subs.includes('Word Game')) types.push('word');

        // Parse GoodPlayers from stringified list
        let goodPlayers: string[] = [];
        try {
          const raw = game['GoodPlayers'];
          if (raw) {
            goodPlayers = raw.replace(/[\[\]']/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } catch { /* ignore parse errors */ }

        const mechanics = mechanicsMap.get(bggId) ?? [];
        const themes = themesMap.get(bggId) ?? [];
        const designers = designersMap.get(bggId)?.filter(d => d !== 'Low-Exp Designer') ?? [];
        const publishers = publishersMap.get(bggId)?.filter(p => p !== 'Low-Exp Publisher') ?? [];

        // Clamp complexity to 1-5 range (DB constraint)
        let complexity = parseFloat_(game['GameWeight']);
        if (complexity !== null) {
          if (complexity < 1) complexity = 1;
          if (complexity > 5) complexity = 5;
        }

        // Clamp rating to 0-10 range (DB constraint)
        let rating = parseFloat_(game['AvgRating']);
        if (rating !== null) {
          if (rating < 0) rating = 0;
          if (rating > 10) rating = 10;
        }

        rows.push({
          id: `bgg-${bggId}`,
          source: 'bgg',
          source_id: bggId,
          name: game['Name'] ?? 'Unknown',
          description: game['Description'] ?? '',
          year_published: parseInt_(game['YearPublished']),
          types,
          min_players: parseInt_(game['MinPlayers']),
          max_players: parseInt_(game['MaxPlayers']),
          recommended_players: parseInt_(game['BestPlayers']),
          min_play_time: parseInt_(game['ComMinPlaytime']) ?? parseInt_(game['MfgPlaytime']),
          max_play_time: parseInt_(game['ComMaxPlaytime']) ?? parseInt_(game['MfgPlaytime']),
          avg_play_time: parseInt_(game['MfgPlaytime']),
          complexity,
          rating,
          rating_count: parseInt_(game['NumUserRatings']),
          categories,
          mechanics,
          themes,
          platforms: [],
          thumbnail_url: game['ImagePath'] || null,
          image_url: game['ImagePath'] || null,
          source_url: `https://boardgamegeek.com/boardgame/${bggId}`,
          // Extended fields (migration 003)
          bayes_avg_rating: parseFloat_(game['BayesAvgRating']),
          rating_stddev: parseFloat_(game['StdDev']),
          community_age_rec: parseFloat_(game['ComAgeRec']),
          mfg_age_rec: parseInt_(game['MfgAgeRec']),
          language_ease: parseFloat_(game['LanguageEase']),
          best_players: game['BestPlayers'] || null,
          good_players: goodPlayers.length > 0 ? goodPlayers : [],
          community_min_playtime: parseInt_(game['ComMinPlaytime']),
          community_max_playtime: parseInt_(game['ComMaxPlaytime']),
          num_owned: parseInt_(game['NumOwned']),
          num_want: parseInt_(game['NumWant']),
          num_wish: parseInt_(game['NumWish']),
          num_comments: parseInt_(game['NumComments']),
          num_expansions: parseInt_(game['NumExpansions']),
          is_reimplementation: game['IsReimplementation'] === '1',
          family: game['Family'] || null,
          kickstarted: game['Kickstarted'] === '1',
          rank_overall: parseRank(game['Rank:boardgame']),
          rank_strategy: parseRank(game['Rank:strategygames']),
          rank_family: parseRank(game['Rank:familygames']),
          rank_party: parseRank(game['Rank:partygames']),
          rank_abstract: parseRank(game['Rank:abstracts']),
          rank_thematic: parseRank(game['Rank:thematic']),
          rank_wargame: parseRank(game['Rank:wargames']),
          rank_cgs: parseRank(game['Rank:cgs']),
          rank_childrens: parseRank(game['Rank:childrensgames']),
          designers,
          publishers,
          artists: [],  // Could add from artists_reduced.csv but it's huge
        });
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

  console.log(`[${timestamp()}] Parsed ${rows.length} games from CSV`);

  // Upsert in batches
  let totalInserted = 0;
  let totalFailed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    let success = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'source,source_id' });

      if (!error) {
        totalInserted += batch.length;
        success = true;
        break;
      }

      console.error(`  [${timestamp()}] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${attempt + 1}): ${error.message}`);
      await sleep(3000);
    }

    if (!success) {
      totalFailed += batch.length;
    }

    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`[${timestamp()}] Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} | Inserted: ${totalInserted} | Failed: ${totalFailed}`);
    }
  }

  console.log(`\n[${timestamp()}] [BGG Import] Done!`);
  console.log(`  Total parsed: ${rows.length}`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Failed: ${totalFailed}`);
}

importGames().catch((err) => {
  console.error(`[${timestamp()}] Fatal error:`, err);
  process.exit(1);
});
