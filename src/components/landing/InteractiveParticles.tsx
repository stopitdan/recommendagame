'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';

/**
 * Interactive particle field that responds to mouse movement.
 * Particles drift lazily, then scatter/attract when the cursor is nearby.
 * Disabled on mobile (touch devices) for performance.
 */
export default function InteractiveParticles({ count = 120 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const theme = useTheme();

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const mouse = mouseRef.current;

    // Initialize particles on first frame
    if (!(canvas as any)._particles) {
      (canvas as any)._particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2.5 + 0.5,
        baseAlpha: Math.random() * 0.4 + 0.1,
        // 0 = circle, 1 = diamond, 2 = tiny square
        shape: Math.floor(Math.random() * 3),
      }));
    }

    const particles = (canvas as any)._particles;

    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      // Distance from mouse
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const interactRadius = 150;

      // Push particles away from cursor (gentler force)
      if (dist < interactRadius && dist > 0) {
        const force = (interactRadius - dist) / interactRadius;
        const angle = Math.atan2(dy, dx);
        p.vx += Math.cos(angle) * force * 0.4;
        p.vy += Math.sin(angle) * force * 0.4;
      }

      // Gentle pull back toward original area (prevents all particles leaving)
      const centerX = w / 2;
      const centerY = h / 2;
      p.vx += (centerX - p.x) * 0.00015;
      p.vy += (centerY - p.y) * 0.00015;

      // Cap velocity so particles don't fly off screen
      const maxV = 3;
      p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
      p.vy = Math.max(-maxV, Math.min(maxV, p.vy));

      // Drift + friction
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;

      // Wrap edges
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      // Glow when near mouse
      const glow = dist < interactRadius ? (interactRadius - dist) / interactRadius : 0;
      const alpha = p.baseAlpha + glow * 0.5;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = glow > 0.3
        ? theme.palette.secondary.main
        : theme.palette.primary.light;

      const s = p.size + glow * 3;

      if (p.shape === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 1) {
        // Diamond
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      }

      // Draw connection lines between nearby particles
      for (const q of particles) {
        if (p === q) continue;
        const ddx = p.x - q.x;
        const ddy = p.y - q.y;
        const d2 = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d2 < 80) {
          ctx.globalAlpha = (80 - d2) / 80 * 0.08;
          ctx.strokeStyle = theme.palette.primary.main;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }, [count, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for touch device — skip particles on mobile
    const isTouchDevice = 'ontouchstart' in window;
    if (isTouchDevice) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      // Reset particles on resize
      (canvas as any)._particles = null;
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleLeave);

    const frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleLeave);
      cancelAnimationFrame(frame);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  );
}
