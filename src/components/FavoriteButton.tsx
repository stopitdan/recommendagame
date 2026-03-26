'use client';

import { useState, useRef, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { motion, AnimatePresence } from 'motion/react';

export interface FavoriteButtonProps {
  gameId: string;
  initialFavorited?: boolean;
  onToggle?: (favorited: boolean) => void;
}

/** Tiny heart particles that burst from the button on favorite */
function HeartBurst({ onComplete }: { onComplete: () => void }) {
  const particles = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 18 + Math.random() * 12;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0.4 + Math.random() * 0.4,
      delay: Math.random() * 0.05,
    };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: p.scale }}
          transition={{ duration: 0.5, delay: p.delay, ease: 'easeOut' }}
          onAnimationComplete={p.id === 0 ? onComplete : undefined}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -4,
            marginLeft: -4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ['#FF6D3F', '#FF4081', '#FFD700', '#5B4FDB', '#00E5A0', '#FF9100'][p.id % 6],
          }}
        />
      ))}
    </div>
  );
}

export default function FavoriteButton({ gameId, initialFavorited = false, onToggle }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  const handleBurstComplete = useCallback(() => setShowBurst(false), []);

  async function toggle() {
    setLoading(true);
    try {
      if (favorited) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(gameId)}`, { method: 'DELETE' });
        if (res.ok) {
          setFavorited(false);
          onToggle?.(false);
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        });
        if (res.ok) {
          setFavorited(true);
          setShowBurst(true);
          onToggle?.(true);
        }
      }
    } catch {
      // Silently fail — user may not be logged in
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tooltip title={favorited ? 'Remove from favorites' : 'Add to favorites'}>
      <IconButton
        onClick={toggle}
        disabled={loading}
        size="small"
        sx={{
          position: 'relative',
          color: favorited ? 'secondary.main' : 'divider',
          transition: 'color 200ms ease',
          '&:hover': {
            color: 'secondary.main',
          },
        }}
      >
        <motion.div
          animate={favorited ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </motion.div>
        <AnimatePresence>
          {showBurst && <HeartBurst onComplete={handleBurstComplete} />}
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}
