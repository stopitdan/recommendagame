'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Plus, Minus, Maximize2, ExternalLink, ChevronUp } from 'lucide-react';
import { useMapTree } from './useMapTree';
import { MapRenderer } from './MapRenderer';
import { CameraController } from './CameraController';
import { TYPE_COLORS, TYPE_LABELS, hierarchyColor } from './types';
import type { MapNode, HierarchyNode } from './types';

interface GameMapProps {
  flyTarget?: string;
  height?: number;
}

export default function GameMap({ flyTarget, height = 700 }: GameMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const { tree, loading, error, progress, getAncestorPath, getGame } = useMapTree();

  const [focusNodeId, setFocusNodeId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState<HierarchyNode[]>([]);

  const [hoveredBubble, setHoveredBubble] = useState<HierarchyNode | null>(null);
  const [hoveredGame, setHoveredGame] = useState<MapNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [, setRenderTick] = useState(0);

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const lastOverlayUpdate = useRef(0);

  // ─── Fit camera to children of a node ──────────────────

  const fitToCurrentNode = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    const bounds = renderer.getChildrenBounds();
    if (bounds) {
      camera.flyToFit(bounds.cx, bounds.cy, bounds.worldRadius);
    }
  }, []);

  // ─── Initialize PixiJS ──────────────────────────────────

  useEffect(() => {
    if (!tree || !containerRef.current || rendererRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;

    const renderer = new MapRenderer({ container, width, height });

    renderer.init().then(() => {
      renderer.setTree(tree);
      rendererRef.current = renderer;

      const canvas = container.querySelector('canvas');
      if (canvas) {
        const camera = new CameraController(canvas, (state) => {
          renderer.updateViewport(state);
          const now = Date.now();
          if (now - lastOverlayUpdate.current > 33) {
            lastOverlayUpdate.current = now;
            setRenderTick((t) => t + 1);
          }
        });
        cameraRef.current = camera;

        // Fit initial view to show all L1 clusters
        const bounds = renderer.getChildrenBounds();
        if (bounds) {
          camera.flyToFit(bounds.cx, bounds.cy, bounds.worldRadius);
        }
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
  }, [tree]);

  useEffect(() => {
    rendererRef.current?.setFocusNode(focusNodeId);
  }, [focusNodeId]);

  useEffect(() => {
    if (!containerRef.current || !rendererRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      rendererRef.current?.resize(entry.contentRect.width, height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height, initialized]);

  // ─── Navigation ─────────────────────────────────────────

  const drillInto = useCallback((node: HierarchyNode) => {
    setFocusNodeId(node.id);
    setBreadcrumbs((prev) => [...prev, node]);
    setSelectedNode(null);
    // Use a microtask so the renderer updates focusNodeId first
    setTimeout(() => fitToCurrentNode(), 0);
  }, [fitToCurrentNode]);

  const navigateUp = useCallback(() => {
    if (!tree) return;
    const currentNode = tree.hierarchy.get(focusNodeId);
    if (!currentNode || !currentNode.parentId) return;

    const parent = tree.hierarchy.get(currentNode.parentId);
    if (!parent) return;

    setFocusNodeId(parent.id);
    setBreadcrumbs((prev) => prev.slice(0, -1));
    setSelectedNode(null);
    setTimeout(() => fitToCurrentNode(), 0);
  }, [tree, focusNodeId, fitToCurrentNode]);

  const navigateToBreadcrumb = useCallback((index: number) => {
    if (index < 0) {
      setFocusNodeId('root');
      setBreadcrumbs([]);
      setSelectedNode(null);
      setTimeout(() => fitToCurrentNode(), 0);
      return;
    }

    const target = breadcrumbs[index];
    if (!target) return;
    setFocusNodeId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSelectedNode(null);
    setTimeout(() => fitToCurrentNode(), 0);
  }, [breadcrumbs, fitToCurrentNode]);

  // ─── Mouse events ───────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

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

    const bubble = rendererRef.current.bubbleHitTest(sx, sy);
    if (bubble) {
      rendererRef.current.setHoveredBubble(bubble.id);
      setHoveredBubble(bubble);
      setHoveredGame(null);
      return;
    }

    const game = rendererRef.current.gameHitTest(sx, sy);
    if (game) {
      rendererRef.current.setHoveredGame(game.id);
      setHoveredGame(game);
      setHoveredBubble(null);
      return;
    }

    rendererRef.current.setHoveredBubble(null);
    rendererRef.current.setHoveredGame(null);
    setHoveredBubble(null);
    setHoveredGame(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current || !mouseDownPos.current) return;

    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    mouseDownPos.current = null;
    if (dx * dx + dy * dy > 25) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const bubble = rendererRef.current.bubbleHitTest(sx, sy);
    if (bubble) {
      drillInto(bubble);
      return;
    }

    const game = rendererRef.current.gameHitTest(sx, sy);
    if (game) {
      setSelectedNode(game);
      return;
    }

    // Clicked empty space -> navigate up
    if (focusNodeId !== 'root') {
      navigateUp();
    } else {
      setSelectedNode(null);
    }
  }, [drillInto, navigateUp, focusNodeId]);

  // ─── Zoom controls ──────────────────────────────────────

  function zoomIn() {
    if (!cameraRef.current) return;
    const s = cameraRef.current.state;
    cameraRef.current.flyTo(s.x, s.y, Math.min(s.zoom * 1.5, 10));
  }

  // Minus: navigate up a layer (or just zoom out if at root)
  function zoomOutOrUp() {
    if (focusNodeId !== 'root') {
      navigateUp();
    } else if (cameraRef.current) {
      const s = cameraRef.current.state;
      cameraRef.current.flyTo(s.x, s.y, Math.max(s.zoom / 1.5, 0.05));
    }
  }

  function resetView() {
    setFocusNodeId('root');
    setBreadcrumbs([]);
    setSelectedNode(null);
    setTimeout(() => fitToCurrentNode(), 0);
  }

  // ─── Fly to game from search ────────────────────────────

  useEffect(() => {
    if (!flyTarget || !initialized || !tree) return;
    const game = getGame(flyTarget);
    if (game) {
      const path = getAncestorPath(flyTarget);
      if (path.length > 0) {
        const l4Parent = path[path.length - 1];
        setFocusNodeId(l4Parent.id);
        setBreadcrumbs(path.slice(1));
      }
      setSelectedNode(game);
      cameraRef.current?.flyTo(game.x, game.y, 3.0);
      setSearchNotFound(false);
    } else {
      setSearchNotFound(true);
      setTimeout(() => setSearchNotFound(false), 4000);
    }
  }, [flyTarget, initialized, tree, getGame, getAncestorPath]);

  // ─── Render ─────────────────────────────────────────────

  const focusNode = tree?.hierarchy.get(focusNodeId);
  const isLeafLevel = focusNode?.level === 4;
  const canGoUp = focusNodeId !== 'root';

  if (loading) {
    return (
      <Box sx={{
        height, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: 2,
        bgcolor: '#0A0A1A', borderRadius: 3,
      }}>
        <CircularProgress
          size={40}
          variant={progress > 0 && progress < 100 ? 'determinate' : 'indeterminate'}
          value={progress}
          sx={{ color: '#5B4FDB' }}
        />
        <Typography color="#AAA" variant="body2">
          Loading game map... {progress > 0 && progress < 100 ? `${progress}%` : ''}
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
      {/* PixiJS canvas */}
      <Box
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        sx={{ width: '100%', height: '100%' }}
      />

      {/* Bubble labels overlay */}
      {rendererRef.current && !isLeafLevel && (
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {rendererRef.current.visibleBubbles.map((bubble) => {
            if (bubble.screenRadius < 18) return null;
            const cw = containerRef.current?.clientWidth ?? 800;
            if (bubble.screenX < -50 || bubble.screenX > cw + 50) return null;
            if (bubble.screenY < -30 || bubble.screenY > height + 30) return null;

            return (
              <Box
                key={bubble.node.id}
                sx={{
                  position: 'absolute',
                  left: bubble.screenX,
                  top: bubble.screenY,
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  maxWidth: bubble.screenRadius * 1.8,
                }}
              >
                <Typography
                  sx={{
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: bubble.screenRadius > 60 ? '0.85rem' : bubble.screenRadius > 40 ? '0.75rem' : '0.6rem',
                    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bubble.node.label}
                </Typography>
                {bubble.screenRadius > 25 && (
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '0.5rem',
                      textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {bubble.node.count.toLocaleString()} games
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Game name labels at leaf level */}
      {rendererRef.current && isLeafLevel && (
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {rendererRef.current.visibleGames
            .filter((vg) => vg.screenRadius > 5)
            .map((vg) => (
              <Typography
                key={vg.game.id}
                sx={{
                  position: 'absolute',
                  left: vg.screenX,
                  top: vg.screenY + vg.screenRadius + 4,
                  transform: 'translateX(-50%)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.55rem',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {vg.game.name}
              </Typography>
            ))}
        </Box>
      )}

      {/* Breadcrumbs (top-left) */}
      {breadcrumbs.length > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute', top: 12, left: 12,
            px: 2, py: 0.75, borderRadius: 2,
            bgcolor: 'rgba(20,20,40,0.9)', backdropFilter: 'blur(8px)',
            zIndex: 5,
          }}
        >
          <Breadcrumbs
            separator=">"
            sx={{ '& .MuiBreadcrumbs-separator': { color: 'rgba(255,255,255,0.3)', mx: 0.5 } }}
          >
            <Link
              component="button"
              underline="hover"
              onClick={() => navigateToBreadcrumb(-1)}
              sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              All Games
            </Link>
            {breadcrumbs.map((node, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return isLast ? (
                <Typography key={node.id} sx={{ color: '#FFF', fontSize: '0.75rem', fontWeight: 600 }}>
                  {node.label}
                </Typography>
              ) : (
                <Link
                  key={node.id}
                  component="button"
                  underline="hover"
                  onClick={() => navigateToBreadcrumb(i)}
                  sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  {node.label}
                </Link>
              );
            })}
          </Breadcrumbs>
        </Paper>
      )}

      {/* Controls (bottom right) */}
      <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <IconButton onClick={zoomIn} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          <Plus size={18} />
        </IconButton>
        <IconButton onClick={zoomOutOrUp} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          {canGoUp ? <ChevronUp size={18} /> : <Minus size={18} />}
        </IconButton>
        <IconButton onClick={resetView} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#FFF', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
          <Maximize2 size={18} />
        </IconButton>
      </Box>

      {/* Hover tooltip for clusters */}
      {hoveredBubble && !selectedNode && (
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
          <Box sx={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            bgcolor: hierarchyColor(hoveredBubble.colorIndex, hoveredBubble.level),
          }} />
          <Typography variant="subtitle2" fontWeight={700}>
            {hoveredBubble.label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {hoveredBubble.count.toLocaleString()} games
          </Typography>
        </Paper>
      )}

      {/* Game hover/selected info */}
      {(() => {
        const displayNode = hoveredGame ?? selectedNode;
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
        {focusNode ? `${focusNode.count.toLocaleString()} games` : ''}
      </Typography>

      {/* Search not found */}
      {searchNotFound && (
        <Paper
          sx={{
            position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
            px: 2, py: 1, borderRadius: 2,
            bgcolor: 'rgba(255,80,80,0.9)', color: '#FFF', zIndex: 10,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {"This game isn't on the map yet (no embedding data)"}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
