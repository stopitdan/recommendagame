'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Plus, Minus, Maximize2, ExternalLink } from 'lucide-react';
import { useMapData } from './useMapData';
import { MapRenderer } from './MapRenderer';
import { CameraController } from './CameraController';
import { TYPE_COLORS, TYPE_LABELS, getLODLevel, LODLevel, clusterColor, CLUSTER_COLORS } from './types';
import type { MapNode, ViewportState } from './types';

interface GameMapProps {
  /** Initial game to fly to */
  initialGameId?: string;
  height?: number;
}

export default function GameMap({ initialGameId, height = 700 }: GameMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const { data, loading, error, progress, getNode } = useMapData();
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<{ label: string; count: number } | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [lodLevel, setLodLevel] = useState(LODLevel.Galaxy);
  const [viewportState, setViewportState] = useState<ViewportState>({ x: 5000, y: 5000, zoom: 0.15 });
  const [initialized, setInitialized] = useState(false);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  // Throttle React re-renders for overlay positioning
  const lastOverlayUpdate = useRef(0);

  // Initialize PixiJS renderer when data is ready
  useEffect(() => {
    if (!data || !containerRef.current) return;
    // Don't re-init if already set up
    if (rendererRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;

    const renderer = new MapRenderer({
      container,
      width,
      height,
      nodes: data.nodes,
      clusters: data.clusters,
    });

    renderer.init().then(() => {
      rendererRef.current = renderer;

      const canvas = container.querySelector('canvas');
      if (canvas) {
        const camera = new CameraController(canvas, (state: ViewportState) => {
          renderer.updateViewport(state);
          setLodLevel(getLODLevel(state.zoom));
          // Throttle overlay updates to ~30fps
          const now = Date.now();
          if (now - lastOverlayUpdate.current > 33) {
            lastOverlayUpdate.current = now;
            setViewportState({ ...state });
          }
        });

        if (initialGameId) {
          const node = getNode(initialGameId);
          if (node) {
            camera.flyTo(node.x, node.y, 3.0);
          }
        }

        cameraRef.current = camera;
      }

      setInitialized(true);
    });

    return () => {
      cameraRef.current?.destroy();
      rendererRef.current?.destroy();
      cameraRef.current = null;
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !rendererRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      rendererRef.current?.resize(w, height);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height, initialized]);

  // Track mouse down position to distinguish click from drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Hover: check dynamic clusters first, then solo nodes
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return;
    if (mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      if (dx * dx + dy * dy > 25) return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Try dynamic cluster first
    const dc = rendererRef.current.dynClusterHitTest(sx, sy);
    if (dc) {
      rendererRef.current.setHoveredDynCluster(dc);
      setHoveredNode(null);
      setHoveredCluster({ label: dc.label, count: dc.count });
      return;
    }

    // Then try individual node
    const node = rendererRef.current.hitTest(sx, sy);
    rendererRef.current.setHoveredNode(node);
    setHoveredNode(node);
    setHoveredCluster(null);
  }, []);

  // Click: if hitting a dynamic cluster, zoom into it.
  // If hitting a solo node, select it.
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current || !mouseDownPos.current) return;

    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    mouseDownPos.current = null;
    if (dx * dx + dy * dy > 25) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Check dynamic cluster first
    const dc = rendererRef.current.dynClusterHitTest(sx, sy);
    if (dc) {
      // Zoom into this cluster: double the current zoom, centered on cluster
      const newZoom = Math.min((cameraRef.current?.state.zoom ?? 0.15) * 2.5, 10);
      cameraRef.current?.flyTo(dc.cx, dc.cy, newZoom);
      setSelectedNode(null);
      return;
    }

    // Check individual node
    const node = rendererRef.current.hitTest(sx, sy);
    if (node) {
      setSelectedNode(node);
      // Small zoom bump to center on node
      const curZoom = cameraRef.current?.state.zoom ?? 1;
      cameraRef.current?.flyTo(node.x, node.y, Math.max(curZoom, curZoom * 1.3));
    } else {
      setSelectedNode(null);
    }
  }, []);

  // Zoom buttons
  function zoomIn() {
    if (!cameraRef.current) return;
    const s = cameraRef.current.state;
    cameraRef.current.flyTo(s.x, s.y, Math.min(s.zoom * 1.5, 10));
  }

  function zoomOut() {
    if (!cameraRef.current) return;
    const s = cameraRef.current.state;
    cameraRef.current.flyTo(s.x, s.y, Math.max(s.zoom / 1.5, 0.05));
  }

  function resetView() {
    cameraRef.current?.flyTo(5000, 5000, 0.15);
  }

  // Fly to game when initialGameId changes (from search)
  const [searchNotFound, setSearchNotFound] = useState(false);
  useEffect(() => {
    if (!initialGameId || !initialized) return;
    const node = getNode(initialGameId);
    if (node && cameraRef.current) {
      cameraRef.current.flyTo(node.x, node.y, 3.0);
      setSelectedNode(node);
      setSearchNotFound(false);
    } else if (initialGameId) {
      setSearchNotFound(true);
      setTimeout(() => setSearchNotFound(false), 4000);
    }
  }, [initialGameId, initialized, getNode]);

  // Loading state
  if (loading) {
    return (
      <Box sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        bgcolor: '#0A0A1A',
        borderRadius: 3,
      }}>
        <CircularProgress size={40} variant={progress > 0 && progress < 100 ? 'determinate' : 'indeterminate'} value={progress} sx={{ color: '#5B4FDB' }} />
        <Typography color="#AAA" variant="body2">
          Loading game map... {progress > 0 && progress < 100 ? `${progress}%` : ''}
        </Typography>
        <Typography color="#666" variant="caption">
          {data ? `${data.nodes.length.toLocaleString()} games` : 'Fetching data...'}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#0A0A1A', borderRadius: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height, borderRadius: 3, overflow: 'hidden', bgcolor: '#0A0A1A' }}>
      {/* PixiJS canvas container */}
      <Box
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        sx={{ width: '100%', height: '100%' }}
      />

      {/* Dynamic cluster labels -- positioned over the PixiJS bubbles */}
      {rendererRef.current && (
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {rendererRef.current.dynClusters.map((dc, i) => {
            const cw = containerRef.current?.clientWidth ?? 800;
            const screenX = (dc.cx - viewportState.x) * viewportState.zoom + cw / 2;
            const screenY = (dc.cy - viewportState.y) * viewportState.zoom + height / 2;

            if (screenX < -50 || screenX > cw + 50 || screenY < -30 || screenY > height + 30) return null;

            const r = Math.max(15, Math.sqrt(dc.count) * 3) * viewportState.zoom;
            // Only show label if bubble is big enough on screen
            if (r < 20) return null;

            return (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: screenX,
                  top: screenY,
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  maxWidth: r * 2,
                }}
              >
                <Typography
                  sx={{
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: r > 40 ? '0.75rem' : '0.6rem',
                    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dc.label.replace(/&#039;/g, "'")}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.55rem',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {dc.count}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Zoom controls (bottom right) */}
      <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <IconButton onClick={zoomIn} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          <Plus size={18} />
        </IconButton>
        <IconButton onClick={zoomOut} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          <Minus size={18} />
        </IconButton>
        <IconButton onClick={resetView} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          <Maximize2 size={18} />
        </IconButton>
      </Box>

      {/* Legend (bottom left) */}
      <Box sx={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {TYPE_COLORS.slice(0, 4).map((color, i) => (
          <Chip
            key={i}
            size="small"
            label={TYPE_LABELS[i]}
            sx={{
              bgcolor: `${color}33`,
              color: color,
              fontWeight: 600,
              fontSize: '0.65rem',
              height: 24,
              borderColor: `${color}55`,
              border: '1px solid',
            }}
          />
        ))}
      </Box>

      {/* Cluster hover info (at galaxy zoom) */}
      {hoveredCluster && !selectedNode && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            px: 2.5, py: 1.5, borderRadius: 2.5,
            bgcolor: 'rgba(20,20,40,0.95)', color: '#FFF',
            display: 'flex', alignItems: 'center', gap: 1.5,
            backdropFilter: 'blur(8px)', pointerEvents: 'none', zIndex: 5,
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            {hoveredCluster.label.replace(/&#039;/g, "'")}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {hoveredCluster.count.toLocaleString()} games
          </Typography>
        </Paper>
      )}

      {/* Game node hover/selected info */}
      {(() => {
        const displayNode = hoveredNode ?? selectedNode;
        if (!displayNode) return null;
        const isSelected = selectedNode?.id === displayNode.id;
        return (
          <Paper
            elevation={12}
            sx={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              px: 2.5, py: 1.5, borderRadius: 2.5,
              bgcolor: 'rgba(20,20,40,0.95)', color: '#FFF',
              display: 'flex', alignItems: 'center', gap: 2,
              backdropFilter: 'blur(8px)',
              pointerEvents: isSelected ? 'auto' : 'none', zIndex: 5,
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: TYPE_COLORS[displayNode.t], flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{displayNode.name}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {TYPE_LABELS[displayNode.t]}
                {displayNode.rating ? ` · ${displayNode.rating.toFixed(1)}/10` : ''}
                {displayNode.ratingCount ? ` · ${displayNode.ratingCount.toLocaleString()} ratings` : ''}
              </Typography>
            </Box>
            {isSelected && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ExternalLink size={14} />}
                  onClick={() => router.push(`/games/${encodeURIComponent(displayNode.id)}`)}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', ml: 1, whiteSpace: 'nowrap' }}
                >
                  View Game
                </Button>
                <IconButton size="small" onClick={() => setSelectedNode(null)} sx={{ color: 'rgba(255,255,255,0.5)', ml: -0.5 }}>
                  ×
                </IconButton>
              </>
            )}
          </Paper>
        );
      })()}

      {/* Game count (top right) */}
      <Typography
        variant="caption"
        sx={{ position: 'absolute', top: 8, right: 12, color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}
      >
        {data ? `${data.nodes.length.toLocaleString()} games` : ''}
      </Typography>

      {/* Search not found message */}
      {searchNotFound && (
        <Paper
          sx={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(255,80,80,0.9)',
            color: '#FFF',
            zIndex: 10,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            This game isn't on the map yet (no embedding data)
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

/** Expose flyToGame for external use (e.g., search) */
export type GameMapHandle = {
  flyToGame: (gameId: string) => void;
};
