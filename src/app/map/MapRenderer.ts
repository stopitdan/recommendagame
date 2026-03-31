/**
 * PixiJS game map renderer with hierarchical cluster navigation.
 *
 * Uses d3.pack() circle packing to lay out children without overlap.
 * Click a bubble to drill into its children (sub-clusters or games).
 */

import { pack, hierarchy as d3hierarchy } from 'd3-hierarchy';
import type { HierarchyNode, MapNode, MapTree, ViewportState } from './types';
import { hierarchyColorHex } from './types';

let PIXI: typeof import('pixi.js') | null = null;
async function getPixi() {
  if (!PIXI) PIXI = await import('pixi.js');
  return PIXI;
}

/** Visible bubble representing a hierarchy node */
export interface VisibleBubble {
  node: HierarchyNode;
  screenX: number;
  screenY: number;
  screenRadius: number;
  worldX: number;
  worldY: number;
  worldRadius: number;
}

/** Visible game dot at leaf level */
export interface VisibleGame {
  game: MapNode;
  screenX: number;
  screenY: number;
  screenRadius: number;
  worldX: number;
  worldY: number;
}

interface RendererOptions {
  container: HTMLElement;
  width: number;
  height: number;
}

/** Packed layout positions for one level of children */
interface PackedLayout {
  focusNodeId: string;
  centerX: number;
  centerY: number;
  outerRadius: number;
  items: Array<{ id: string; x: number; y: number; r: number }>;
}

export class MapRenderer {
  private app: InstanceType<typeof import('pixi.js').Application> | null = null;
  private world: InstanceType<typeof import('pixi.js').Container> | null = null;
  private gfx: InstanceType<typeof import('pixi.js').Graphics> | null = null;
  private opts: RendererOptions;
  private viewport: ViewportState = { x: 5000, y: 5000, zoom: 0.15 };
  private destroyed = false;
  private renderScheduled = false;

  private tree: MapTree | null = null;
  private focusNodeId = 'root';

  /** Cached packed layout for the current focus node */
  private packedLayout: PackedLayout | null = null;

  /** Currently visible hierarchy bubbles */
  visibleBubbles: VisibleBubble[] = [];
  /** Currently visible game dots at leaf level */
  visibleGames: VisibleGame[] = [];

  hoveredBubbleId: string | null = null;
  hoveredGameId: string | null = null;

  private transitionProgress = 1;
  private transitionStart = 0;
  private static TRANSITION_DURATION = 400;

  constructor(opts: RendererOptions) {
    this.opts = opts;
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

    this.gfx = new pixi.Graphics();
    this.world.addChild(this.gfx);
  }

  setTree(tree: MapTree) {
    this.tree = tree;
    this.packedLayout = null;
    this.scheduleRender();
  }

  setFocusNode(nodeId: string) {
    if (this.focusNodeId === nodeId) return;
    this.focusNodeId = nodeId;
    this.packedLayout = null; // invalidate layout cache
    this.transitionProgress = 0;
    this.transitionStart = performance.now();
    this.scheduleRender();
  }

  getFocusNodeId(): string {
    return this.focusNodeId;
  }

  // ─── Circle Packing Layout ─────────────────────────────

  /**
   * Use d3.pack() to compute non-overlapping circle positions for the
   * children of the current focus node. Results are in world coordinates
   * centered on the focus node's centroid.
   */
  private computePackedLayout(): PackedLayout {
    if (!this.tree) throw new Error('No tree');
    const focusNode = this.tree.hierarchy.get(this.focusNodeId);
    if (!focusNode) throw new Error('Focus node not found');

    const isLeaf = focusNode.level === 4;

    // Build a simple hierarchy for d3.pack()
    interface PackDatum { id: string; value: number; children?: PackDatum[] }

    let rootDatum: PackDatum;

    if (isLeaf) {
      // Children are game IDs
      const children: PackDatum[] = focusNode.children
        .filter((gid) => this.tree!.games.has(gid))
        .map((gid) => {
          const game = this.tree!.games.get(gid)!;
          const rc = game.ratingCount ?? 10;
          return { id: gid, value: Math.max(1, Math.sqrt(rc)) };
        });
      rootDatum = { id: 'pack-root', value: 0, children };
    } else {
      // Children are hierarchy nodes
      const children: PackDatum[] = focusNode.children
        .filter((cid) => this.tree!.hierarchy.has(cid))
        .map((cid) => {
          const child = this.tree!.hierarchy.get(cid)!;
          return { id: cid, value: child.count };
        });
      rootDatum = { id: 'pack-root', value: 0, children };
    }

    // Use a large packing radius so we have room in world space
    const packSize = isLeaf ? 600 : 3000;

    const root = d3hierarchy(rootDatum)
      .sum((d) => d.value)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const packer = pack<PackDatum>()
      .size([packSize, packSize])
      .padding(isLeaf ? 8 : packSize * 0.03);

    packer(root);

    // Convert d3 output to our format, centered on the focus node's centroid
    const offsetX = focusNode.cx - packSize / 2;
    const offsetY = focusNode.cy - packSize / 2;

    const items: PackedLayout['items'] = [];
    // d3.pack() adds x, y, r to nodes but TypeScript doesn't expose r on the type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootAny = root as any;
    if (rootAny.children) {
      for (const child of rootAny.children) {
        items.push({
          id: child.data.id,
          x: (child.x ?? 0) + offsetX,
          y: (child.y ?? 0) + offsetY,
          r: child.r ?? 10,
        });
      }
    }

    return {
      focusNodeId: this.focusNodeId,
      centerX: focusNode.cx,
      centerY: focusNode.cy,
      outerRadius: rootAny.r ?? packSize / 2,
      items,
    };
  }

  private getPackedLayout(): PackedLayout {
    if (!this.packedLayout || this.packedLayout.focusNodeId !== this.focusNodeId) {
      this.packedLayout = this.computePackedLayout();
    }
    return this.packedLayout;
  }

  /**
   * Get the bounding info for the packed layout (for camera fitting).
   */
  getChildrenBounds(): { cx: number; cy: number; worldRadius: number } | null {
    if (!this.tree) return null;
    const focusNode = this.tree.hierarchy.get(this.focusNodeId);
    if (!focusNode) return null;

    const layout = this.getPackedLayout();
    return {
      cx: layout.centerX,
      cy: layout.centerY,
      worldRadius: layout.outerRadius * 1.15,
    };
  }

  // ─── Viewport & Rendering ──────────────────────────────

  updateViewport(state: ViewportState) {
    this.viewport = state;
    if (!this.world || !this.app) return;

    const cx = this.opts.width / 2;
    const cy = this.opts.height / 2;
    this.world.x = cx - state.x * state.zoom;
    this.world.y = cy - state.y * state.zoom;
    this.world.scale.set(state.zoom);

    this.scheduleRender();
  }

  private scheduleRender() {
    if (this.renderScheduled || this.destroyed) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      if (!this.destroyed) this.render();
    });
  }

  private render() {
    const g = this.gfx;
    if (!g || !this.tree || this.destroyed) return;
    g.clear();

    if (this.transitionProgress < 1) {
      const elapsed = performance.now() - this.transitionStart;
      this.transitionProgress = Math.min(1, elapsed / MapRenderer.TRANSITION_DURATION);
      this.transitionProgress = 1 - Math.pow(1 - this.transitionProgress, 3);
      if (this.transitionProgress < 1) this.scheduleRender();
    }

    const fadeAlpha = this.transitionProgress;
    const focusNode = this.tree.hierarchy.get(this.focusNodeId);
    if (!focusNode) return;

    const layout = this.getPackedLayout();
    const isLeafLevel = focusNode.level === 4;

    if (isLeafLevel) {
      this.renderGameLeaves(g, focusNode, layout, fadeAlpha);
    } else {
      this.renderHierarchyBubbles(g, focusNode, layout, fadeAlpha);
    }
  }

  private renderHierarchyBubbles(
    g: InstanceType<typeof import('pixi.js').Graphics>,
    _focusNode: HierarchyNode,
    layout: PackedLayout,
    fadeAlpha: number,
  ) {
    const bubbles: VisibleBubble[] = [];
    const { zoom } = this.viewport;

    for (const item of layout.items) {
      const child = this.tree!.hierarchy.get(item.id);
      if (!child) continue;

      const screenX = (item.x - this.viewport.x) * zoom + this.opts.width / 2;
      const screenY = (item.y - this.viewport.y) * zoom + this.opts.height / 2;
      const screenR = item.r * zoom;

      // Frustum cull
      if (screenX + screenR < -20 || screenX - screenR > this.opts.width + 20 ||
          screenY + screenR < -20 || screenY - screenR > this.opts.height + 20) {
        continue;
      }

      const isHovered = this.hoveredBubbleId === child.id;
      const color = hierarchyColorHex(child.colorIndex, child.level);

      // Solid filled circle
      g.circle(item.x, item.y, item.r);
      g.fill({ color, alpha: fadeAlpha * (isHovered ? 0.75 : 0.55) });

      // Stroke
      g.circle(item.x, item.y, item.r);
      g.stroke({ color: 0xFFFFFF, alpha: fadeAlpha * (isHovered ? 0.4 : 0.12), width: isHovered ? 2.5 : 1 });

      bubbles.push({
        node: child,
        screenX, screenY, screenRadius: screenR,
        worldX: item.x, worldY: item.y, worldRadius: item.r,
      });
    }

    this.visibleBubbles = bubbles;
    this.visibleGames = [];
  }

  private renderGameLeaves(
    g: InstanceType<typeof import('pixi.js').Graphics>,
    focusNode: HierarchyNode,
    layout: PackedLayout,
    fadeAlpha: number,
  ) {
    const visGames: VisibleGame[] = [];
    const { zoom } = this.viewport;

    for (const item of layout.items) {
      const game = this.tree!.games.get(item.id);
      if (!game) continue;

      const screenX = (item.x - this.viewport.x) * zoom + this.opts.width / 2;
      const screenY = (item.y - this.viewport.y) * zoom + this.opts.height / 2;
      const screenR = item.r * zoom;

      if (screenX + screenR < -20 || screenX - screenR > this.opts.width + 20 ||
          screenY + screenR < -20 || screenY - screenR > this.opts.height + 20) {
        continue;
      }

      const isHovered = this.hoveredGameId === game.id;
      const color = hierarchyColorHex(focusNode.colorIndex, 4);

      if (isHovered) {
        g.circle(item.x, item.y, item.r + 3);
        g.fill({ color: 0xFFFFFF, alpha: fadeAlpha * 0.2 });
      }

      g.circle(item.x, item.y, item.r);
      g.fill({ color, alpha: fadeAlpha * (isHovered ? 1.0 : 0.8) });

      if (isHovered) {
        g.circle(item.x, item.y, item.r);
        g.stroke({ color: 0xFFFFFF, alpha: fadeAlpha * 0.5, width: 1.5 });
      }

      visGames.push({
        game,
        screenX, screenY, screenRadius: screenR,
        worldX: item.x, worldY: item.y,
      });
    }

    this.visibleBubbles = [];
    this.visibleGames = visGames;
  }

  // ─── Hit Testing ─────────────────────────────────────────

  bubbleHitTest(screenX: number, screenY: number): HierarchyNode | null {
    // Test smallest bubbles first so you can click inside overlapping areas
    const sorted = [...this.visibleBubbles].sort((a, b) => a.screenRadius - b.screenRadius);
    for (const bubble of sorted) {
      const dx = screenX - bubble.screenX;
      const dy = screenY - bubble.screenY;
      if (dx * dx + dy * dy < bubble.screenRadius * bubble.screenRadius) {
        return bubble.node;
      }
    }
    return null;
  }

  gameHitTest(screenX: number, screenY: number): MapNode | null {
    const hitR = 20;
    let best: MapNode | null = null;
    let bestDist = hitR * hitR;

    for (const vg of this.visibleGames) {
      const dx = screenX - vg.screenX;
      const dy = screenY - vg.screenY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = vg.game;
      }
    }
    return best;
  }

  // ─── Hover State ─────────────────────────────────────────

  setHoveredBubble(nodeId: string | null) {
    if (this.hoveredBubbleId === nodeId) return;
    this.hoveredBubbleId = nodeId;
    this.hoveredGameId = null;
    this.setCursor(nodeId ? 'pointer' : 'grab');
    this.scheduleRender();
  }

  setHoveredGame(gameId: string | null) {
    if (this.hoveredGameId === gameId) return;
    this.hoveredGameId = gameId;
    this.hoveredBubbleId = null;
    this.setCursor(gameId ? 'pointer' : 'grab');
    this.scheduleRender();
  }

  private setCursor(cursor: string) {
    if (this.app) {
      (this.app.canvas as HTMLCanvasElement).style.cursor = cursor;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────

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
