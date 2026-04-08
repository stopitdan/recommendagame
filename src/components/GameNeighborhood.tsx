'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { ExternalLink } from 'lucide-react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { getGameTypeConfig } from '@/lib/game-type-config';
import type { GameType } from '@/types/game';
import { getFromClientCache, setInClientCache } from '@/lib/client-cache';

interface NodeData extends SimulationNodeDatum {
  id: string;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  types: string[];
  similarity: number;
  isCenter: boolean;
  radius: number;
}

interface LinkData extends SimulationLinkDatum<NodeData> {
  similarity: number;
}

interface GameNeighborhoodProps {
  gameId: string;
  height?: number;
  onRecenter?: (gameId: string, gameName: string) => void;
}

export default function GameNeighborhood({ gameId, height = 450, onRecenter }: GameNeighborhoodProps) {
  const router = useRouter();
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centerInfo, setCenterInfo] = useState<{ id: string; name: string } | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const linksRef = useRef<LinkData[]>([]);
  const hoveredRef = useRef<NodeData | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<NodeData>> | null>(null);
  const widthRef = useRef(600);

  const isDark = theme.palette.mode === 'dark';
  const textColor = isDark ? '#E0E0E0' : '#333333';
  const textShadow = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
  const linkColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hoverLinkColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';

  const loadNeighborhood = useCallback(async (targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/games/${encodeURIComponent(targetId)}/neighborhood`;
      const cached = getFromClientCache(url);
      let data;
      if (cached && !cached.isStale) {
        data = cached.data;
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load');
        data = await res.json();
        setInClientCache(url, data);
      }
      const { center, neighbors } = data as { center: NodeData; neighbors: NodeData[] };

      setCenterInfo({ id: center.id, name: center.name });

      const centerNode: NodeData = {
        id: center.id,
        name: center.name,
        rating: center.rating,
        ratingCount: center.ratingCount,
        types: center.types,
        similarity: 1,
        isCenter: true,
        radius: 30,
        // Place center in the middle
        x: widthRef.current / 2,
        y: height / 2,
      };

      const neighborNodes: NodeData[] = (neighbors ?? []).map((n: NodeData & { similarity: number }) => ({
        id: n.id,
        name: n.name,
        rating: n.rating,
        ratingCount: n.ratingCount,
        types: n.types,
        similarity: n.similarity,
        isCenter: false,
        radius: 12 + Math.min(Math.log10((n.ratingCount ?? 50) + 1) * 3, 10),
      }));

      nodesRef.current = [centerNode, ...neighborNodes];
      linksRef.current = neighborNodes.map((n) => ({
        source: centerNode.id,
        target: n.id,
        similarity: n.similarity,
      }));

      runSimulation();
    } catch {
      setError('Could not load game neighborhood');
    } finally {
      setLoading(false);
    }
  }, [height]);

  // Load initial game
  useEffect(() => {
    loadNeighborhood(gameId);
    return () => { simRef.current?.stop(); };
  }, [gameId, loadNeighborhood]);

  function runSimulation() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.parentElement?.clientWidth ?? 600;
    widthRef.current = width;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    simRef.current?.stop();

    const sim = forceSimulation<NodeData>(nodesRef.current)
      .force('link', forceLink<NodeData, LinkData>(linksRef.current)
        .id((d) => d.id)
        .distance((d) => 90 + (1 - d.similarity) * 100)
        .strength((d) => d.similarity * 0.4)
      )
      .force('charge', forceManyBody<NodeData>().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<NodeData>().radius((d) => d.radius + 8))
      .velocityDecay(0.5)
      .alphaDecay(0.06)
      .on('tick', () => draw(canvas, width));

    simRef.current = sim;
  }

  function draw(canvas: HTMLCanvasElement, width: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hovered = hoveredRef.current;

    ctx.save();
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    // Draw links
    for (const link of links) {
      const source = link.source as NodeData;
      const target = link.target as NodeData;
      if (source.x == null || target.x == null) continue;

      const isHL = hovered && (hovered.id === source.id || hovered.id === target.id);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y!);
      ctx.lineTo(target.x, target.y!);
      ctx.strokeStyle = isHL ? hoverLinkColor : linkColor;
      ctx.lineWidth = isHL ? 1.5 : 0.5 + link.similarity;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;

      const isHov = hovered?.id === node.id;
      const typeColor = getGameTypeConfig((node.types[0] ?? 'board') as GameType).color;
      const r = node.radius;

      // Glow
      if (node.isCenter || isHov) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = `${typeColor}33`;
        ctx.fill();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = typeColor;
      ctx.fill();

      // Border
      ctx.strokeStyle = (node.isCenter || isHov) ? '#FFFFFF' : `${typeColor}55`;
      ctx.lineWidth = node.isCenter ? 3 : isHov ? 2 : 1;
      ctx.stroke();

      // Rating inside node (if large enough)
      if (r >= 16 && node.rating) {
        ctx.font = `700 ${r >= 22 ? 11 : 9}px "DM Sans", sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(node.rating.toFixed(1), node.x, node.y + 4);
      }

      // Name label
      const fs = node.isCenter ? 11 : 9;
      ctx.font = `${node.isCenter ? '700' : '500'} ${fs}px "DM Sans", sans-serif`;
      ctx.textAlign = 'center';
      const label = node.name.length > 22 ? node.name.slice(0, 20) + '...' : node.name;

      // Shadow for readability
      ctx.fillStyle = textShadow;
      ctx.fillText(label, node.x + 0.5, node.y + r + fs + 5);
      ctx.fillStyle = textColor;
      ctx.fillText(label, node.x, node.y + r + fs + 4);
    }

    ctx.restore();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: NodeData | null = null;
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < (node.radius + 4) ** 2) {
        found = node;
        break;
      }
    }

    hoveredRef.current = found;
    canvas.style.cursor = found ? 'pointer' : 'default';
    draw(canvas, widthRef.current);
  }

  function handleClick() {
    const node = hoveredRef.current;
    if (!node || node.isCenter) return;

    // Re-center on this node without remounting
    onRecenter?.(node.id, node.name);
    loadNeighborhood(node.id);
  }

  if (!centerInfo && !loading && !error) {
    // Nothing loaded yet -- show empty state
    return null;
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      {loading && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 3,
        }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'background.paper', px: 2, py: 1, borderRadius: 2, boxShadow: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading...</Typography>
          </Box>
        </Box>
      )}

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height }}
      />

      {centerInfo && (
        <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<ExternalLink size={14} />}
            onClick={() => router.push(`/games/${encodeURIComponent(centerInfo.id)}`)}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 2, px: 2, py: 0.5 }}
          >
            View {centerInfo.name.length > 25 ? centerInfo.name.slice(0, 23) + '...' : centerInfo.name}
          </Button>
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ position: 'absolute', top: 8, right: 12, opacity: 0.6, fontSize: '0.7rem' }}
      >
        Click a node to explore
      </Typography>

      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
    </Box>
  );
}
