'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';
import { useTheme } from '@mui/material/styles';

/**
 * Floating game pieces (dice, card, meeple, controller) that follow
 * the cursor with spring-physics lag. Each piece has different mass
 * and damping for organic, playful movement.
 */

const PIECES = [
  { emoji: '🎲', size: 44, stiffness: 40, damping: 15, offsetX: -120, offsetY: -80, rotate: 15 },
  { emoji: '🃏', size: 38, stiffness: 30, damping: 18, offsetX: 100, offsetY: -60, rotate: -10 },
  { emoji: '♟️', size: 36, stiffness: 25, damping: 20, offsetX: -80, offsetY: 70, rotate: 8 },
  { emoji: '🎮', size: 40, stiffness: 35, damping: 16, offsetX: 110, offsetY: 50, rotate: -12 },
  { emoji: '🧩', size: 32, stiffness: 20, damping: 22, offsetX: -40, offsetY: -120, rotate: 20 },
  { emoji: '🏆', size: 34, stiffness: 28, damping: 19, offsetX: 60, offsetY: 100, rotate: -5 },
];

function FollowerPiece({ emoji, size, stiffness, damping, offsetX, offsetY, rotate, mouseX, mouseY }: {
  emoji: string;
  size: number;
  stiffness: number;
  damping: number;
  offsetX: number;
  offsetY: number;
  rotate: number;
  mouseX: number;
  mouseY: number;
}) {
  const x = useSpring(0, { stiffness, damping });
  const y = useSpring(0, { stiffness, damping });
  const r = useSpring(0, { stiffness: stiffness * 0.5, damping: damping * 1.5 });

  useEffect(() => {
    x.set(mouseX + offsetX);
    y.set(mouseY + offsetY);
    r.set(rotate + (mouseX * 0.02));
  }, [mouseX, mouseY, x, y, r, offsetX, offsetY, rotate]);

  return (
    <motion.div
      style={{
        x,
        y,
        rotate: r,
        position: 'fixed',
        fontSize: size,
        pointerEvents: 'none',
        zIndex: 9999,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
        willChange: 'transform',
      }}
    >
      {emoji}
    </motion.div>
  );
}

export default function MouseFollowers() {
  const [mouse, setMouse] = useState({ x: -500, y: -500 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on touch devices
    if ('ontouchstart' in window) return;

    const handle = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);
    };

    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {PIECES.map((piece, i) => (
        <FollowerPiece key={i} {...piece} mouseX={mouse.x} mouseY={mouse.y} />
      ))}
    </div>
  );
}
