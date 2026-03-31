/**
 * Export map node data to a static JSON file for the client.
 *
 * Reads games with map_x/map_y from the database and exports a compact
 * JSON file to public/data/map-nodes.json. Field names are single-character
 * to minimize file size (~4MB for 40k games).
 *
 * Usage: npx tsx scripts/export-map-data.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Type index mapping
const TYPE_MAP: Record<string, number> = {
  board: 0, video: 1, word: 2, party: 3, card: 4,
};

interface CompactNode {
  id: string;
  x: number;
  y: number;
  t: number;          // type index
  n: string;          // name
  r: number | null;   // rating
  rc: number | null;  // ratingCount
  c: number;          // clusterId
  th: string | null;  // thumbnailUrl
}

async function main() {
  // Check if we have a local positions JSON from the UMAP script
  const positionsPath = path.join(__dirname, 'map-positions.json');
  const hasLocalPositions = fs.existsSync(positionsPath);

  let positionMap: Map<string, { x: number; y: number; c: number }> | null = null;
  if (hasLocalPositions) {
    console.log('[Export] Loading positions from local map-positions.json...');
    const positions: Array<{ id: string; x: number; y: number; c: number }> = JSON.parse(
      fs.readFileSync(positionsPath, 'utf8')
    );
    positionMap = new Map(positions.map((p) => [p.id, p]));
    console.log(`[Export] Loaded ${positionMap.size} positions from file`);
  }

  console.log('[Export] Fetching game metadata from Supabase...');

  const allNodes: CompactNode[] = [];
  let offset = 0;
  const pageSize = 1000;

  // If we have local positions, fetch ALL games (not just those with map_x set)
  // and merge positions from the file. This is much faster than waiting for DB writes.
  while (true) {
    let query = supabase
      .from('games')
      .select('id, name, types, rating, rating_count, map_x, map_y, map_cluster_id, thumbnail_url')
      .eq('is_expansion', false);

    if (!positionMap) {
      // No local file -- only get games with DB positions
      query = query.not('map_x', 'is', null);
    }

    const { data, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('id');

    if (error) {
      console.error('[Export] Query error:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      const types = (row.types as string[]) ?? [];
      // Prefer local position file, fall back to DB
      const localPos = positionMap?.get(row.id as string);
      const x = localPos?.x ?? (row.map_x as number | null);
      const y = localPos?.y ?? (row.map_y as number | null);
      const c = localPos?.c ?? (row.map_cluster_id as number | null);

      if (x == null || y == null) continue;

      allNodes.push({
        id: row.id,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        t: TYPE_MAP[types[0]] ?? 0,
        n: row.name as string,
        r: row.rating != null ? Math.round((row.rating as number) * 10) / 10 : null,
        rc: row.rating_count as number | null,
        c: c ?? 0,
        th: row.thumbnail_url as string | null,
      });
    }

    offset += pageSize;
    if (offset % 5000 === 0) console.log(`  ... ${allNodes.length} games with positions (scanned ${offset})`);
  }

  if (allNodes.length === 0) {
    console.log('[Export] No games with map positions found. Run compute-map-positions.py first.');
    return;
  }
  console.log(`[Export] Total games with positions: ${allNodes.length}`);

  // Load cluster metadata from the Python script output
  let clusters: Array<{ id: number; cx: number; cy: number; label: string; primaryType: string; count: number }> = [];
  const clusterPath = path.join(__dirname, 'map-clusters.json');
  if (fs.existsSync(clusterPath)) {
    clusters = JSON.parse(fs.readFileSync(clusterPath, 'utf8'));
    console.log(`[Export] Loaded ${clusters.length} clusters from ${clusterPath}`);
  } else {
    console.warn('[Export] No map-clusters.json found. Cluster labels will be missing.');
  }

  // Compute bounds
  const xs = allNodes.map((n) => n.x);
  const ys = allNodes.map((n) => n.y);

  const output = {
    nodes: allNodes,
    clusters,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    },
  };

  // Write to public/data/
  const outDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'map-nodes.json');
  fs.writeFileSync(outPath, JSON.stringify(output));

  const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`\n[Export] Done! ${allNodes.length} games exported to ${outPath} (${sizeKB} KB)`);
}

main().catch(console.error);
