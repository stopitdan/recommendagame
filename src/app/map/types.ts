/**
 * Types for the interactive game map visualization.
 *
 * The map uses a pre-computed hierarchical cluster tree (4 levels deep)
 * rendered via PixiJS with smooth drill-down navigation.
 */

// ---------------------------------------------------------------------------
// Game nodes (individual games on the map)
// ---------------------------------------------------------------------------

export interface MapNode {
  id: string;
  x: number;
  y: number;
  /** Type index: 0=board, 1=video, 2=word, 3=party, 4=card */
  t: number;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  thumbnailUrl: string | null;
  /** ID of the L4 hierarchy node this game belongs to */
  parentId: string;
}

// ---------------------------------------------------------------------------
// Hierarchy tree
// ---------------------------------------------------------------------------

export interface HierarchyNode {
  id: string;           // "root", "L1-0", "L2-15", "L3-42", "L4-537"
  level: number;        // 0=root, 1-4=hierarchy levels
  label: string;        // LLM-generated name, e.g. "Worker Placement Euros"
  cx: number;           // centroid x in world coords [0, 10000]
  cy: number;           // centroid y
  radius: number;       // bounding radius of all contained games
  count: number;        // total games inside this cluster
  colorIndex: number;   // inherited from L1 ancestor (0-11), -1 for root
  children: string[];   // child hierarchy node IDs, or game IDs at level 4
  parentId: string | null;
}

export interface MapTree {
  hierarchy: Map<string, HierarchyNode>;
  games: Map<string, MapNode>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

// ---------------------------------------------------------------------------
// Legacy flat cluster type (kept for export-map-data backward compat)
// ---------------------------------------------------------------------------

export interface MapCluster {
  id: number;
  cx: number;
  cy: number;
  label: string;
  primaryType: string;
  count: number;
}

export interface MapData {
  nodes: MapNode[];
  clusters: MapCluster[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

// ---------------------------------------------------------------------------
// Viewport & camera
// ---------------------------------------------------------------------------

export interface ViewportState {
  x: number;       // center x in world coords
  y: number;       // center y in world coords
  zoom: number;    // scale factor (1 = 1:1, 0.1 = see whole map)
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const TYPE_COLORS = [
  '#5B4FDB', // board (indigo)
  '#FF6D3F', // video (coral)
  '#0EC6C6', // word (cyan)
  '#FFB020', // party (gold)
  '#5B4FDB', // card (indigo)
];

export const TYPE_LABELS = ['Board', 'Video', 'Word', 'Party', 'Card'];

/** 12 distinct cluster colors so adjacent clusters look different */
export const CLUSTER_COLORS = [
  '#E74C3C', // red
  '#3498DB', // blue
  '#2ECC71', // green
  '#F39C12', // orange
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#E67E22', // dark orange
  '#5DADE2', // light blue
  '#F1C40F', // yellow
  '#E84393', // pink
  '#00CEC9', // cyan
  '#6C5CE7', // indigo
];

export function clusterColor(colorIndex: number): string {
  if (colorIndex < 0) return '#888888';
  return CLUSTER_COLORS[colorIndex % CLUSTER_COLORS.length];
}

export function clusterColorHex(colorIndex: number): number {
  return parseInt(clusterColor(colorIndex).replace('#', ''), 16);
}

/**
 * Lighten a hex color by mixing with white.
 * amount: 0 = original, 1 = white
 */
export function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

/**
 * Get the display color for a hierarchy node, lightened by depth.
 * L1 = base color, L2 = 10% lighter, L3 = 20%, L4 = 30%
 */
export function hierarchyColor(colorIndex: number, level: number): string {
  const base = clusterColor(colorIndex);
  const lighten = Math.max(0, (level - 1) * 0.1);
  return lightenColor(base, lighten);
}

export function hierarchyColorHex(colorIndex: number, level: number): number {
  return parseInt(hierarchyColor(colorIndex, level).replace('#', ''), 16);
}
