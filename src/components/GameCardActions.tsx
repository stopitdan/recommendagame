'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'motion/react';

export interface GameCardActionsProps {
  gameId: string;
  /** Called when user clicks "Not This" — parent should remove the card */
  onDismiss?: (gameId: string) => void;
  /** Called when user clicks "More Like This" — parent should trigger search */
  onMoreLikeThis?: (gameId: string) => void;
}

/**
 * Thumbs-down and "More Like This" action buttons for game cards.
 * Sits alongside the existing FavoriteButton in the card header.
 */
export default function GameCardActions({ gameId, onDismiss, onMoreLikeThis }: GameCardActionsProps) {
  const [dismissed, setDismissed] = useState(false);

  function handleDismiss() {
    setDismissed(true);

    // Fire-and-forget feedback API (don't block UI for guest users)
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, rating: -1, context: 'not-this' }),
    }).catch(() => {});

    onDismiss?.(gameId);
  }

  function handleMoreLikeThis() {
    onMoreLikeThis?.(gameId);
  }

  return (
    <>
      <Tooltip title="Not this">
        <IconButton
          onClick={handleDismiss}
          disabled={dismissed}
          size="small"
          aria-label="Not this game"
          sx={{
            color: 'text.disabled',
            transition: 'color 200ms ease',
            '&:hover': { color: 'error.main' },
          }}
        >
          <motion.div whileTap={{ scale: 0.8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
          </motion.div>
        </IconButton>
      </Tooltip>

      <Tooltip title="More like this">
        <IconButton
          onClick={handleMoreLikeThis}
          size="small"
          aria-label="More like this game"
          sx={{
            color: 'text.disabled',
            transition: 'color 200ms ease',
            '&:hover': { color: 'success.main' },
          }}
        >
          <motion.div whileTap={{ scale: 0.8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </motion.div>
        </IconButton>
      </Tooltip>
    </>
  );
}
