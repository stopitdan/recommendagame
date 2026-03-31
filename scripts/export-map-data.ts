/**
 * Export hierarchical map tree data to a static JSON file for the client.
 *
 * Reads the hierarchy from map-hierarchy.json and game metadata from Supabase,
 * then exports a compact JSON file to public/data/map-tree.json.
 *
 * Also maintains backward-compatible public/data/map-nodes.json.
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

const TYPE_MAP: Record<string, number> = {
  board: 0, video: 1, word: 2, party: 3, card: 4,
};

// ---------------------------------------------------------------------------
// Types matching the Python output
// ---------------------------------------------------------------------------

interface HierarchyNode {
  id: string;
  level: number;
  label: string;
  cx: number;
  cy: number;
  radius: number;
  count: number;
  colorIndex: number;
  children: string[];
  parentId: string | null;
}

interface HierarchyFile {
  meta: { gameCount: number; levels: number; generated: string };
  nodes: Record<string, HierarchyNode>;
}

// Compact output types
interface CompactHierarchyNode {
  l: number;    // level
  n: string;    // label
  cx: number;
  cy: number;
  r: number;    // radius
  ct: number;   // count
  co: number;   // colorIndex
  ch: string[]; // children
  p: string | null; // parentId
}

interface CompactGameNode {
  id: string;
  x: number;
  y: number;
  t: number;          // type index
  n: string;          // name
  r: number | null;   // rating
  rc: number | null;  // ratingCount
  p: string;          // parentId (L4 hierarchy node)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load hierarchy
  const hierarchyPath = path.join(__dirname, 'map-hierarchy.json');
  if (!fs.existsSync(hierarchyPath)) {
    console.error('[Export] map-hierarchy.json not found. Run compute-map-hierarchy.py first.');
    process.exit(1);
  }

  console.log('[Export] Loading hierarchy...');
  const hierarchy: HierarchyFile = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
  console.log(`[Export] Loaded ${Object.keys(hierarchy.nodes).length} hierarchy nodes`);

  // Collect all leaf game IDs and their L4 parent
  const gameToParent = new Map<string, string>();
  for (const [nodeId, node] of Object.entries(hierarchy.nodes)) {
    if (node.level === 4) {
      for (const gameId of node.children) {
        gameToParent.set(gameId, nodeId);
      }
    }
  }
  console.log(`[Export] ${gameToParent.size} leaf games found`);

  // Also load local positions as fallback
  const positionsPath = path.join(__dirname, 'map-positions.json');
  let positionMap: Map<string, { x: number; y: number; c: number }> | null = null;
  if (fs.existsSync(positionsPath)) {
    const positions: Array<{ id: string; x: number; y: number; c: number }> = JSON.parse(
      fs.readFileSync(positionsPath, 'utf8')
    );
    positionMap = new Map(positions.map((p) => [p.id, p]));
    console.log(`[Export] Loaded ${positionMap.size} positions from file`);
  }

  // Fetch game metadata from Supabase
  console.log('[Export] Fetching game metadata from Supabase...');
  const allGames: CompactGameNode[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name, types, rating, rating_count, map_x, map_y, thumbnail_url')
      .eq('is_expansion', false)
      .range(offset, offset + pageSize - 1)
      .order('id');

    if (error) {
      console.error('[Export] Query error:', error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const parentId = gameToParent.get(row.id as string);
      if (!parentId) continue; // not in hierarchy

      const types = (row.types as string[]) ?? [];
      const localPos = positionMap?.get(row.id as string);
      const x = localPos?.x ?? (row.map_x as number | null);
      const y = localPos?.y ?? (row.map_y as number | null);

      if (x == null || y == null) continue;

      allGames.push({
        id: row.id,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        t: TYPE_MAP[types[0]] ?? 0,
        n: row.name as string,
        r: row.rating != null ? Math.round((row.rating as number) * 10) / 10 : null,
        rc: row.rating_count as number | null,
        p: parentId,
      });
    }

    offset += pageSize;
    if (offset % 5000 === 0) console.log(`  ... ${allGames.length} games processed (scanned ${offset})`);
  }

  if (allGames.length === 0) {
    console.log('[Export] No games found. Check hierarchy and database.');
    return;
  }
  console.log(`[Export] Total games: ${allGames.length}`);

  // Build compact hierarchy
  const compactHierarchy: Record<string, CompactHierarchyNode> = {};
  for (const [nodeId, node] of Object.entries(hierarchy.nodes)) {
    compactHierarchy[nodeId] = {
      l: node.level,
      n: node.label,
      cx: node.cx,
      cy: node.cy,
      r: node.radius,
      ct: node.count,
      co: node.colorIndex,
      ch: node.children,
      p: node.parentId,
    };
  }

  // Compute bounds
  const xs = allGames.map((g) => g.x);
  const ys = allGames.map((g) => g.y);

  const treeOutput = {
    h: compactHierarchy,
    g: allGames,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    },
  };

  // Write tree JSON
  const outDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const treePath = path.join(outDir, 'map-tree.json');
  fs.writeFileSync(treePath, JSON.stringify(treeOutput));
  const treeSize = Math.round(fs.statSync(treePath).size / 1024);
  console.log(`\n[Export] Tree: ${allGames.length} games + ${Object.keys(compactHierarchy).length} hierarchy nodes -> ${treePath} (${treeSize} KB)`);

  // Also write backward-compatible flat map-nodes.json
  const flatOutput = {
    nodes: allGames.map((g) => ({
      id: g.id, x: g.x, y: g.y, t: g.t, n: g.n, r: g.r, rc: g.rc, c: 0,
    })),
    clusters: [], // empty, no longer used
    bounds: treeOutput.bounds,
  };
  const flatPath = path.join(outDir, 'map-nodes.json');
  fs.writeFileSync(flatPath, JSON.stringify(flatOutput));
  const flatSize = Math.round(fs.statSync(flatPath).size / 1024);
  console.log(`[Export] Flat (compat): ${flatPath} (${flatSize} KB)`);
}

main().catch(console.error);
