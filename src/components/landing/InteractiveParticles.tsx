'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';

/**
 * Interactive particle field that responds to mouse movement.
 * Particles drift lazily, then scatter when the cursor is nearby.
 * Disabled on mobile (touch devices) for performance.
 */
export default function InteractiveParticles({ count = 100 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const theme = useTheme();
  const cssW = useRef(0);
  const cssH = useRef(0);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = cssW.current;
    const h = cssH.current;
    if (w === 0 || h === 0) { requestAnimationFrame(animate); return; }

    const mouse = mouseRef.current;

    // Initialize particles
    if (!(canvas as any)._particles) {
      (canvas as any)._particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        homeX: 0, // set below
        homeY: 0,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 0.5,
        baseAlpha: Math.random() * 0.35 + 0.08,
        shape: Math.floor(Math.random() * 3),
      }));
      // Store home positions (where particles return to)
      for (const p of (canvas as any)._particles) {
        p.homeX = p.x;
        p.homeY = p.y;
      }
    }

    const particles = (canvas as any)._particles;

    // Scale context for retina
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const interactRadius = 120;

      // Push away from cursor (gentle)
      if (dist < interactRadius && dist > 0) {
        const force = (interactRadius - dist) / interactRadius;
        const angle = Math.atan2(dy, dx);
        p.vx += Math.cos(angle) * force * 0.3;
        p.vy += Math.sin(angle) * force * 0.3;
      }

      // Pull back toward home position (so they always return)
      p.vx += (p.homeX - p.x) * 0.003;
      p.vy += (p.homeY - p.y) * 0.003;

      // Cap velocity
      const maxV = 2;
      p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
      p.vy = Math.max(-maxV, Math.min(maxV, p.vy));

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;

      // Glow near mouse
      const glow = dist < interactRadius ? (interactRadius - dist) / interactRadius : 0;
      const alpha = p.baseAlpha + glow * 0.4;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = glow > 0.3
        ? theme.palette.secondary.main
        : theme.palette.primary.light;

      const s = p.size + glow * 2;

      if (p.shape === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 1) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      }
    }

    // Connection lines (only nearby particles)
    ctx.globalAlpha = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const ddx = particles[i].x - particles[j].x;
        const ddy = particles[i].y - particles[j].y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < 70) {
          ctx.globalAlpha = (70 - d) / 70 * 0.06;
          ctx.strokeStyle = theme.palette.primary.main;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
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
    if ('ontouchstart' in window) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW.current = rect.width;
      cssH.current = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // Reset particles on resize so home positions are correct
      (canvas as any)._particles = null;
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleLeave = () => { mouseRef.current = { x: -1000, y: -1000 }; };

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
