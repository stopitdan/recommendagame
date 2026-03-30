'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
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
  /** Height of the canvas area */
  height?: number;
}

export default function GameNeighborhood({ gameId, height = 450 }: GameNeighborhoodProps) {
  const router = useRouter();
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const linksRef = useRef<LinkData[]>([]);
  const hoveredRef = useRef<NodeData | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<NodeData>> | null>(null);

  const isDark = theme.palette.mode === 'dark';
  const bgColor = isDark ? '#1A1A2E' : '#FDFAF6';
  const textColor = isDark ? '#E0E0E0' : '#333333';
  const linkColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hoverLinkColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/neighborhood`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      const { center, neighbors } = data;

      // Build nodes: center + neighbors
      const centerNode: NodeData = {
        id: center.id,
        name: center.name,
        rating: center.rating,
        ratingCount: center.ratingCount,
        types: center.types,
        similarity: 1,
        isCenter: true,
        radius: 28,
      };

      const neighborNodes: NodeData[] = (neighbors ?? []).map((n: NodeData & { similarity: number }) => ({
        id: n.id,
        name: n.name,
        rating: n.rating,
        ratingCount: n.ratingCount,
        types: n.types,
        similarity: n.similarity,
        isCenter: false,
        // Scale radius by popularity (log scale)
        radius: 10 + Math.min(Math.log10((n.ratingCount ?? 50) + 1) * 3, 12),
      }));

      nodesRef.current = [centerNode, ...neighborNodes];

      // Build links: center -> each neighbor
      linksRef.current = neighborNodes.map((n) => ({
        source: centerNode.id,
        target: n.id,
        similarity: n.similarity,
      }));

      startSimulation();
    } catch {
      setError('Could not load game neighborhood');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadData();
    return () => { simRef.current?.stop(); };
  }, [loadData]);

  function startSimulation() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.parentElement?.clientWidth ?? 600;
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const nodes = nodesRef.current;
    const links = linksRef.current;

    // Stop any existing simulation
    simRef.current?.stop();

    const sim = forceSimulation<NodeData>(nodes)
      .force('link', forceLink<NodeData, LinkData>(links)
        .id((d) => d.id)
        .distance((d) => 80 + (1 - d.similarity) * 120)
        .strength((d) => d.similarity * 0.5)
      )
      .force('charge', forceManyBody<NodeData>().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<NodeData>().radius((d) => d.radius + 4))
      .on('tick', () => draw(canvas, width, height));

    simRef.current = sim;
  }

  function draw(canvas: HTMLCanvasElement, width: number, height: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hovered = hoveredRef.current;

    ctx.save();
    ctx.scale(2, 2); // Retina scaling
    ctx.clearRect(0, 0, width, height);

    // Draw links
    for (const link of links) {
      const source = link.source as NodeData;
      const target = link.target as NodeData;
      if (source.x == null || target.x == null) continue;

      const isHoveredLink = hovered && (hovered.id === source.id || hovered.id === target.id);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y!);
      ctx.lineTo(target.x, target.y!);
      ctx.strokeStyle = isHoveredLink ? hoverLinkColor : linkColor;
      ctx.lineWidth = isHoveredLink ? 1.5 : 0.5 + link.similarity;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;

      const isHovered = hovered?.id === node.id;
      const typeColor = getGameTypeConfig((node.types[0] ?? 'board') as GameType).color;

      // Glow for hovered/center
      if (node.isCenter || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${typeColor}33`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = typeColor;
      ctx.fill();

      // White border
      ctx.strokeStyle = node.isCenter ? '#FFFFFF' : `${typeColor}88`;
      ctx.lineWidth = node.isCenter ? 3 : 1;
      ctx.stroke();

      // Name label
      const fontSize = node.isCenter ? 11 : 9;
      ctx.font = `${node.isCenter ? '700' : '500'} ${fontSize}px "DM Sans", sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';

      // Truncate long names
      let label = node.name;
      if (label.length > 20) label = label.slice(0, 18) + '...';

      ctx.fillText(label, node.x, node.y + node.radius + fontSize + 4);

      // Rating label inside center node
      if (node.isCenter && node.rating) {
        ctx.font = '700 11px "DM Sans", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(node.rating.toFixed(1), node.x, node.y + 4);
      }
    }

    ctx.restore();
  }

  // Mouse interaction
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const nodes = nodesRef.current;
    let found: NodeData | null = null;

    for (const node of nodes) {
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

    // Redraw for hover effect
    const width = canvas.parentElement?.clientWidth ?? 600;
    draw(canvas, width, height);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const node = hoveredRef.current;
    if (!node) return;

    if (node.isCenter) {
      // Already on this game's page
      return;
    }

    router.push(`/games/${encodeURIComponent(node.id)}`);
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height, gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Loading game map...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', bgcolor: bgColor, border: '1px solid', borderColor: 'divider' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ position: 'absolute', bottom: 8, right: 12, opacity: 0.6, fontSize: '0.7rem' }}
      >
        Click a game to explore
      </Typography>
    </Box>
  );
}
