/**
 * Generate Semantic Embeddings for Game Tags
 *
 * Pre-computes embeddings for all unique categories, mechanics, and themes
 * in the game database. These are used at query time to match user genre
 * terms semantically (cosine similarity > 0.7) instead of exact/substring.
 *
 * Example: user says "roguelike" -> embedding matches "Dungeon Crawler",
 * "Variable Player Powers", "Adventure" with cosine similarity > 0.7,
 * rather than relying on a static alias table.
 *
 * Usage: npx tsx scripts/generate-tag-embeddings.ts
 *
 * Output: scripts/tag-embeddings.json (loaded at API startup)
 * Cost: ~$0.001 (embedding ~500 unique tags)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const OUTPUT_FILE = 'scripts/tag-embeddings.json';
const EMBEDDING_MODEL = 'text-embedding-3-small';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function main() {
  console.log('[Tags] Collecting unique tags from database...');

  // Fetch all unique categories, mechanics, and themes
  const allTags = new Set<string>();

  let offset = 0;
  const batchSize = 5000;
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('categories, mechanics, themes')
      .range(offset, offset + batchSize - 1);

    if (!data || data.length === 0) break;

    for (const g of data) {
      for (const c of (g.categories ?? [])) allTags.add(c);
      for (const m of (g.mechanics ?? [])) allTags.add(m);
      for (const t of (g.themes ?? [])) allTags.add(t);
    }

    offset += batchSize;
    if (data.length < batchSize) break;
  }

  const tags = [...allTags].sort();
  console.log(`[Tags] Found ${tags.length} unique tags`);

  // Generate embeddings in batches
  const embeddings: Record<string, number[]> = {};
  const batchEmbedSize = 500; // OpenAI supports up to 2048

  for (let i = 0; i < tags.length; i += batchEmbedSize) {
    const batch = tags.slice(i, i + batchEmbedSize);
    console.log(`[Tags] Embedding batch ${Math.floor(i / batchEmbedSize) + 1}/${Math.ceil(tags.length / batchEmbedSize)}...`);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    for (let j = 0; j < response.data.length; j++) {
      embeddings[batch[j]] = response.data[j].embedding;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  // Save
  const output = {
    model: EMBEDDING_MODEL,
    dimensions: 1536,
    tagCount: Object.keys(embeddings).length,
    generated: new Date().toISOString(),
    embeddings,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
  console.log(`[Tags] Saved ${output.tagCount} tag embeddings to ${OUTPUT_FILE}`);
  console.log(`[Tags] File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
