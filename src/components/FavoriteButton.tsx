'use client';

import { useState, useRef, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { motion, AnimatePresence } from 'motion/react';
import { useAchievements } from './AchievementToast';

export interface FavoriteButtonProps {
  gameId: string;
  initialFavorited?: boolean;
  onToggle?: (favorited: boolean) => void;
}

/** Tiny heart particles that burst from the button on favorite */
function HeartBurst({ onComplete }: { onComplete: () => void }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const distance = 22 + Math.random() * 18;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0.5 + Math.random() * 0.6,
      delay: Math.random() * 0.08,
      rotation: Math.random() * 360,
    };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: p.scale, rotate: p.rotation }}
          transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
          onAnimationComplete={p.id === 0 ? onComplete : undefined}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -4,
            marginLeft: -4,
            width: p.id % 3 === 0 ? 6 : 9,
            height: p.id % 3 === 0 ? 6 : 9,
            borderRadius: p.id % 2 === 0 ? '50%' : '2px',
            background: ['#FF6D3F', '#FF4081', '#FFD700', '#5B4FDB', '#00E5A0', '#FF9100', '#E040FB', '#00BCD4'][p.id % 8],
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
  const { unlock } = useAchievements();

  const handleBurstComplete = useCallback(() => setShowBurst(false), []);

  async function toggle() {
    // Optimistic update — show the new state immediately
    const wasFavorited = favorited;
    setFavorited(!wasFavorited);
    if (!wasFavorited) {
      setShowBurst(true);
      unlock('first_favorite');
    }
    onToggle?.(!wasFavorited);

    try {
      if (wasFavorited) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(gameId)}`, { method: 'DELETE' });
        if (!res.ok) {
          // Revert on failure
          setFavorited(true);
          onToggle?.(true);
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        });
        if (!res.ok) {
          // Revert on failure
          setFavorited(false);
          setShowBurst(false);
          onToggle?.(false);
        }
      }
    } catch {
      // Revert on error
      setFavorited(wasFavorited);
      onToggle?.(wasFavorited);
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
          animate={favorited ? { scale: [1, 1.5, 0.85, 1.15, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
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
