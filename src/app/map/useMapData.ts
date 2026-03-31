'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapNode, MapCluster, MapData } from './types';

interface UseMapDataResult {
  data: MapData | null;
  loading: boolean;
  error: string | null;
  progress: number; // 0-100
  /** Lookup a node by game ID */
  getNode: (id: string) => MapNode | undefined;
}

/**
 * Loads the static map data JSON and builds lookup structures.
 */
export function useMapData(): UseMapDataResult {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const nodeMapRef = useRef<Map<string, MapNode>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/data/map-nodes.json');
        if (!res.ok) throw new Error(`Failed to load map data: ${res.status}`);

        const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
        const reader = res.body?.getReader();

        if (!reader) {
          // Fallback: no streaming
          const json = await res.json();
          if (!cancelled) processData(json);
          return;
        }

        // Stream the response and track progress
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0 && !cancelled) {
            setProgress(Math.round((received / contentLength) * 100));
          }
        }

        const text = new TextDecoder().decode(
          new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0)).buffer
            ? mergeChunks(chunks)
            : chunks[0]
        );

        if (!cancelled) processData(JSON.parse(text));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
          setLoading(false);
        }
      }
    }

    function processData(raw: { nodes: Array<Record<string, unknown>>; clusters: MapCluster[]; bounds: MapData['bounds'] }) {
      // Map compact JSON field names to full TypeScript interface names
      const nodes: MapNode[] = raw.nodes.map((n) => ({
        id: n.id as string,
        x: n.x as number,
        y: n.y as number,
        t: n.t as number,
        name: (n.n ?? n.name ?? '') as string,
        rating: (n.r ?? n.rating ?? null) as number | null,
        ratingCount: (n.rc ?? n.ratingCount ?? null) as number | null,
        clusterId: (n.c ?? n.clusterId ?? 0) as number,
        thumbnailUrl: (n.th ?? n.thumbnailUrl ?? null) as string | null,
      }));

      const map = new Map<string, MapNode>();
      for (const node of nodes) {
        map.set(node.id, node);
      }
      nodeMapRef.current = map;
      setData({ nodes, clusters: raw.clusters, bounds: raw.bounds });
      setProgress(100);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function getNode(id: string): MapNode | undefined {
    return nodeMapRef.current.get(id);
  }

  return { data, loading, error, progress, getNode };
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
