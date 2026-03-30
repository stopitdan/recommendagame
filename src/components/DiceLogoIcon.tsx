'use client';

import { useRef, useState, useCallback } from 'react';
import { Dice5 } from 'lucide-react';
import Box from '@mui/material/Box';

/**
 * Interactive dice logo icon for the header.
 * Triple-click within 1 second triggers a spin animation.
 */
export default function DiceLogoIcon() {
  const [spinning, setSpinning] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (spinning) return;

    const now = Date.now();
    clickTimestamps.current.push(now);

    // Keep only clicks within the last 1 second
    clickTimestamps.current = clickTimestamps.current.filter(
      (t) => now - t < 1000
    );

    if (clickTimestamps.current.length >= 3) {
      setSpinning(true);
      clickTimestamps.current = [];
      // Reset after animation completes (600ms)
      setTimeout(() => setSpinning(false), 600);
    }
  }, [spinning]);

  return (
    <Box
      component="span"
      onClick={handleClick}
      sx={{
        display: 'inline-flex',
        cursor: 'pointer',
        animation: spinning ? 'diceSpinEaster 0.6s ease-in-out' : 'none',
        '@keyframes diceSpinEaster': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(360deg) scale(1.3)' },
          '100%': { transform: 'rotate(720deg) scale(1)' },
        },
      }}
    >
      <Dice5 size={22} />
    </Box>
  );
}
