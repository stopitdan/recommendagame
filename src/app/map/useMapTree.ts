'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HierarchyNode, MapNode, MapTree } from './types';

/**
 * Compact JSON field names used in public/data/map-tree.json.
 *
 * Hierarchy nodes:  l=level, n=label, cx/cy=centroid, r=radius,
 *                   ct=count, co=colorIndex, ch=children, p=parentId
 * Game nodes:       id, x, y, t=type, n=name, r=rating, rc=ratingCount,
 *                   th=thumbnailUrl, p=parentId
 */

interface CompactHierarchyNode {
  l: number;
  n: string;
  cx: number;
  cy: number;
  r: number;
  ct: number;
  co: number;
  ch: string[];
  p: string | null;
}

interface CompactGameNode {
  id: string;
  x: number;
  y: number;
  t: number;
  n: string;
  r: number | null;
  rc: number | null;
  p: string;
}

interface CompactMapTree {
  h: Record<string, CompactHierarchyNode>;
  g: CompactGameNode[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function useMapTree() {
  const [tree, setTree] = useState<MapTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      try {
        const res = await fetch('/data/map-tree.json');
        if (!res.ok) throw new Error(`Failed to load map data: ${res.status}`);

        const contentLength = res.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        let jsonText: string;

        if (total > 0 && res.body) {
          // Stream with progress tracking
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            setProgress(Math.round((received / total) * 100));
          }

          const merged = new Uint8Array(received);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          jsonText = new TextDecoder().decode(merged);
        } else {
          jsonText = await res.text();
        }

        const raw: CompactMapTree = JSON.parse(jsonText);

        // Parse hierarchy nodes
        const hierarchy = new Map<string, HierarchyNode>();
        for (const [id, compact] of Object.entries(raw.h)) {
          hierarchy.set(id, {
            id,
            level: compact.l,
            label: compact.n,
            cx: compact.cx,
            cy: compact.cy,
            radius: compact.r,
            count: compact.ct,
            colorIndex: compact.co,
            children: compact.ch,
            parentId: compact.p,
          });
        }

        // Parse game nodes
        const games = new Map<string, MapNode>();
        for (const g of raw.g) {
          games.set(g.id, {
            id: g.id,
            x: g.x,
            y: g.y,
            t: g.t,
            name: g.n,
            rating: g.r,
            ratingCount: g.rc,
            thumbnailUrl: null,
            parentId: g.p,
          });
        }

        setTree({ hierarchy, games, bounds: raw.bounds });
        setProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error loading map');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  /** Walk up the hierarchy from a game to the root, returning the path. */
  const getAncestorPath = useMemo(() => {
    if (!tree) return () => [];
    return (gameId: string): HierarchyNode[] => {
      const game = tree.games.get(gameId);
      if (!game) return [];

      const path: HierarchyNode[] = [];
      let currentId: string | null = game.parentId;
      while (currentId) {
        const node = tree.hierarchy.get(currentId);
        if (!node) break;
        path.unshift(node); // prepend so path goes root -> ... -> L4
        currentId = node.parentId;
      }
      return path;
    };
  }, [tree]);

  /** Get a game node by ID. */
  const getGame = useMemo(() => {
    if (!tree) return () => undefined;
    return (gameId: string) => tree.games.get(gameId);
  }, [tree]);

  return { tree, loading, error, progress, getAncestorPath, getGame };
}
