'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

export interface FavoriteButtonProps {
  gameId: string;
  initialFavorited?: boolean;
  onToggle?: (favorited: boolean) => void;
}

export default function FavoriteButton({ gameId, initialFavorited = false, onToggle }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

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
          color: favorited ? '#B9314F' : '#E1DEE3',
          transition: 'all 200ms ease',
          '&:hover': {
            color: '#B9314F',
            transform: 'scale(1.15)',
          },
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </IconButton>
    </Tooltip>
  );
}
