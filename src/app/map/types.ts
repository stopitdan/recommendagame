/**
 * Types for the interactive game map visualization.
 */

export interface MapNode {
  id: string;
  x: number;
  y: number;
  /** Type index: 0=board, 1=video, 2=word, 3=party, 4=card */
  t: number;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  clusterId: number;
  thumbnailUrl: string | null;
}

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

export interface ViewportState {
  x: number;       // center x in world coords
  y: number;       // center y in world coords
  zoom: number;    // scale factor (1 = 1:1, 0.1 = see whole map)
}

export enum LODLevel {
  Galaxy = 0,       // zoom < 0.3 -- cluster blobs only
  Constellation = 1, // 0.3 <= zoom < 1.0 -- small colored dots
  Neighborhood = 2,  // 1.0 <= zoom < 3.0 -- larger circles + labels
  Street = 3,        // zoom >= 3.0 -- thumbnail images + full detail
}

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

export function clusterColor(clusterId: number): string {
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
}

export function clusterColorHex(clusterId: number): number {
  return parseInt(clusterColor(clusterId).replace('#', ''), 16);
}

export function getLODLevel(zoom: number): LODLevel {
  if (zoom < 0.3) return LODLevel.Galaxy;
  if (zoom < 1.0) return LODLevel.Constellation;
  if (zoom < 3.0) return LODLevel.Neighborhood;
  return LODLevel.Street;
}
