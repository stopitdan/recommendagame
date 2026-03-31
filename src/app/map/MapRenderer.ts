/**
 * PixiJS game map renderer with dynamic viewport-based clustering.
 *
 * At any zoom level, visible nodes are grouped into ~20-50 bubbles.
 * Click a bubble to zoom in, groups get smaller, eventually dissolve
 * into individual games. Always ~20-50 things on screen.
 */

import type { MapNode, MapCluster, ViewportState } from './types';
import { CLUSTER_COLORS, clusterColorHex } from './types';

let PIXI: typeof import('pixi.js') | null = null;
async function getPixi() {
  if (!PIXI) PIXI = await import('pixi.js');
  return PIXI;
}

/** A dynamic group of nearby nodes at the current zoom level */
interface DynCluster {
  cx: number;
  cy: number;
  count: number;
  label: string;
  colorIdx: number;
  nodes: MapNode[];
}

function nodeRadius(ratingCount: number | null): number {
  const rc = ratingCount ?? 10;
  return Math.max(2, Math.log10(rc + 1) * 2);
}

interface RendererOptions {
  container: HTMLElement;
  width: number;
  height: number;
  nodes: MapNode[];
  clusters: MapCluster[];
}

export class MapRenderer {
  private app: InstanceType<typeof import('pixi.js').Application> | null = null;
  private world: InstanceType<typeof import('pixi.js').Container> | null = null;
  private gfx: InstanceType<typeof import('pixi.js').Graphics> | null = null;
  private bgGfx: InstanceType<typeof import('pixi.js').Graphics> | null = null;
  nodes: MapNode[];
  clusters: MapCluster[];
  private opts: RendererOptions;
  private viewport: ViewportState = { x: 5000, y: 5000, zoom: 0.15 };
  hoveredNode: MapNode | null = null;
  hoveredDynCluster: DynCluster | null = null;
  private destroyed = false;
  private renderScheduled = false;
  private bgDrawn = false;

  /** Current visible dynamic clusters (for hit testing) */
  dynClusters: DynCluster[] = [];

  constructor(opts: RendererOptions) {
    this.opts = opts;
    this.nodes = opts.nodes;
    this.clusters = opts.clusters;
    this.nodes.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  }

  async init() {
    const pixi = await getPixi();

    this.app = new pixi.Application();
    await this.app.init({
      width: this.opts.width,
      height: this.opts.height,
      backgroundColor: 0x0E0E1C,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.opts.container.appendChild(this.app.canvas as HTMLCanvasElement);
    (this.app.canvas as HTMLCanvasElement).style.cursor = 'grab';

    this.world = new pixi.Container();
    this.app.stage.addChild(this.world);

    // Background fog layer (static)
    this.bgGfx = new pixi.Graphics();
    this.world.addChild(this.bgGfx);
    this.drawBackground();

    // Main drawing layer
    this.gfx = new pixi.Graphics();
    this.world.addChild(this.gfx);

    this.updateViewport(this.viewport);
  }

  private drawBackground() {
    if (!this.bgGfx || this.bgDrawn) return;
    const g = this.bgGfx;
    // Soft fog behind pre-computed clusters for ambient color
    for (const cluster of this.clusters) {
      const color = clusterColorHex(cluster.id);
      const r = Math.sqrt(cluster.count) * 6;
      g.circle(cluster.cx, cluster.cy, r);
      g.fill({ color, alpha: 0.04 });
    }
    this.bgDrawn = true;
  }

  updateViewport(state: ViewportState) {
    this.viewport = state;
    if (!this.world || !this.app) return;

    const cx = this.opts.width / 2;
    const cy = this.opts.height / 2;
    this.world.x = cx - state.x * state.zoom;
    this.world.y = cy - state.y * state.zoom;
    this.world.scale.set(state.zoom);

    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderScheduled = false;
        if (!this.destroyed) this.render();
      });
    }
  }

  private render() {
    const g = this.gfx;
    if (!g || this.destroyed) return;
    g.clear();

    const { zoom } = this.viewport;
    const hw = (this.opts.width / 2) / zoom;
    const hh = (this.opts.height / 2) / zoom;
    const vx1 = this.viewport.x - hw;
    const vy1 = this.viewport.y - hh;
    const vx2 = this.viewport.x + hw;
    const vy2 = this.viewport.y + hh;

    // Get visible nodes
    const visible: MapNode[] = [];
    for (const node of this.nodes) {
      if (node.x >= vx1 && node.x <= vx2 && node.y >= vy1 && node.y <= vy2) {
        visible.push(node);
      }
    }

    // Dynamic clustering: grid-based grouping
    // Grid cell size adapts to viewport: we want ~30-50 cells across the view
    const viewW = vx2 - vx1;
    const viewH = vy2 - vy1;
    const cellSize = Math.max(viewW, viewH) / 25;

    const gridMap = new Map<string, MapNode[]>();
    for (const node of visible) {
      const gx = Math.floor(node.x / cellSize);
      const gy = Math.floor(node.y / cellSize);
      const key = `${gx},${gy}`;
      if (!gridMap.has(key)) gridMap.set(key, []);
      gridMap.get(key)!.push(node);
    }

    // Build dynamic clusters from grid cells
    const dynClusters: DynCluster[] = [];
    const soloNodes: MapNode[] = [];

    for (const [, cellNodes] of gridMap) {
      if (cellNodes.length <= 3) {
        // Too few to cluster -- show individually
        soloNodes.push(...cellNodes);
      } else {
        // Compute centroid
        let sumX = 0, sumY = 0;
        for (const n of cellNodes) { sumX += n.x; sumY += n.y; }
        const cx = sumX / cellNodes.length;
        const cy = sumY / cellNodes.length;

        // Label from most common category of first few nodes
        // (We don't have categories in MapNode, so use pre-computed cluster label)
        const clusterIds = cellNodes.map((n) => n.clusterId);
        const mostCommon = mode(clusterIds);
        const preCluster = this.clusters.find((c) => c.id === mostCommon);
        const label = preCluster?.label?.replace(/&#039;/g, "'") ?? 'Games';

        dynClusters.push({
          cx, cy,
          count: cellNodes.length,
          label,
          colorIdx: mostCommon ?? 0,
          nodes: cellNodes,
        });
      }
    }

    this.dynClusters = dynClusters;

    // Draw dynamic cluster bubbles
    for (const dc of dynClusters) {
      const color = clusterColorHex(dc.colorIdx);
      const r = Math.max(15, Math.sqrt(dc.count) * 3);
      const isHov = this.hoveredDynCluster === dc;

      g.circle(dc.cx, dc.cy, r);
      g.fill({ color, alpha: isHov ? 0.55 : 0.3 });
      g.circle(dc.cx, dc.cy, r);
      g.stroke({ color: 0xFFFFFF, alpha: isHov ? 0.4 : 0.12, width: isHov ? 2 : 1 });
    }

    // Draw solo nodes (not part of a cluster at this zoom)
    for (const node of soloNodes) {
      const color = clusterColorHex(node.clusterId);
      const r = nodeRadius(node.ratingCount);
      const isHov = this.hoveredNode?.id === node.id;

      if (isHov) {
        g.circle(node.x, node.y, r + 4);
        g.fill({ color: 0xFFFFFF, alpha: 0.3 });
      }
      g.circle(node.x, node.y, r);
      g.fill({ color, alpha: isHov ? 1.0 : 0.7 });
      g.circle(node.x, node.y, r);
      g.stroke({ color: 0xFFFFFF, alpha: isHov ? 0.6 : 0.1, width: isHov ? 1.5 : 0.5 });
    }
  }

  /** Hit test: at any zoom, check dynamic clusters first, then solo nodes */
  dynClusterHitTest(screenX: number, screenY: number): DynCluster | null {
    const worldX = this.viewport.x + (screenX - this.opts.width / 2) / this.viewport.zoom;
    const worldY = this.viewport.y + (screenY - this.opts.height / 2) / this.viewport.zoom;

    for (const dc of this.dynClusters) {
      const r = Math.max(15, Math.sqrt(dc.count) * 3);
      const dx = dc.cx - worldX;
      const dy = dc.cy - worldY;
      if (dx * dx + dy * dy < r * r) return dc;
    }
    return null;
  }

  hitTest(screenX: number, screenY: number): MapNode | null {
    const worldX = this.viewport.x + (screenX - this.opts.width / 2) / this.viewport.zoom;
    const worldY = this.viewport.y + (screenY - this.opts.height / 2) / this.viewport.zoom;

    const hitR = 15;
    let best: MapNode | null = null;
    let bestDist = hitR * hitR;

    for (const node of this.nodes) {
      const dx = node.x - worldX;
      const dy = node.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = node;
      }
    }
    return best;
  }

  setHoveredDynCluster(dc: DynCluster | null) {
    if (this.hoveredDynCluster === dc) return;
    this.hoveredDynCluster = dc;
    this.hoveredNode = null;
    if (this.app) {
      (this.app.canvas as HTMLCanvasElement).style.cursor = dc ? 'pointer' : 'grab';
    }
    this.render();
  }

  setHoveredNode(node: MapNode | null) {
    if (this.hoveredNode?.id === node?.id) return;
    this.hoveredNode = node;
    this.hoveredDynCluster = null;
    if (this.app) {
      (this.app.canvas as HTMLCanvasElement).style.cursor = node ? 'pointer' : 'grab';
    }
    this.render();
  }

  resize(width: number, height: number) {
    this.opts.width = width;
    this.opts.height = height;
    this.app?.renderer.resize(width, height);
    this.updateViewport(this.viewport);
  }

  destroy() {
    this.destroyed = true;
    this.app?.destroy(true, { children: true, texture: true });
    this.app = null;
  }
}

/** Find the most common value in an array */
function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  let best = arr[0] ?? 0;
  let bestCount = 0;
  for (const v of arr) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) { bestCount = c; best = v; }
  }
  return best;
}
