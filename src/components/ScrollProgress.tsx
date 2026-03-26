'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';

/**
 * Thin colored progress bar fixed at the top of the viewport.
 * Fills as the user scrolls down the page.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(scrollTop / docHeight, 1));
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (progress <= 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          height: '100%',
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #5B4FDB, #FF6D3F)',
          transition: 'width 50ms linear',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </Box>
  );
}
