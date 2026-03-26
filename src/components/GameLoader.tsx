'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';

type LoaderVariant = 'dice' | 'cards' | 'search';

interface GameLoaderProps {
  /** Which animation to show */
  variant?: LoaderVariant;
  /** Optional message below the animation */
  message?: string;
  /** Size in px (default 64) */
  size?: number;
}

/**
 * Themed loading animations for the game recommendation app.
 * Uses motion for lightweight SVG animations — no external Lottie files needed.
 */
export default function GameLoader({ variant = 'dice', message, size = 64 }: GameLoaderProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
      {variant === 'dice' && <DiceLoader size={size} />}
      {variant === 'cards' && <CardsLoader size={size} />}
      {variant === 'search' && <SearchLoader size={size} />}
      {message && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {message}
          </Typography>
        </motion.div>
      )}
    </Box>
  );
}

/** Bouncing dice animation */
function DiceLoader({ size }: { size: number }) {
  return (
    <motion.div
      animate={{
        y: [0, -12, 0],
        rotate: [0, 15, -10, 5, 0],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ fontSize: size * 0.8, lineHeight: 1 }}
    >
      🎲
    </motion.div>
  );
}

/** Shuffling cards animation — 3 cards fanning in and out */
function CardsLoader({ size }: { size: number }) {
  const cardStyle = {
    width: size * 0.4,
    height: size * 0.55,
    borderRadius: 4,
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    marginTop: -(size * 0.55) / 2,
    marginLeft: -(size * 0.4) / 2,
  };

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      {[
        { color: '#5B4FDB', delay: 0, rotate: [-8, -8, 8, 8, -8] },
        { color: '#FF6D3F', delay: 0.15, rotate: [0, 0, 0, 0, 0] },
        { color: '#0EC6C6', delay: 0.3, rotate: [8, 8, -8, -8, 8] },
      ].map((card, i) => (
        <motion.div
          key={i}
          animate={{
            rotate: card.rotate,
            y: [0, -4, 0, 4, 0],
          }}
          transition={{
            duration: 1.5,
            delay: card.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            ...cardStyle,
            backgroundColor: card.color,
            zIndex: 3 - i,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </Box>
  );
}

/** Magnifying glass search animation */
function SearchLoader({ size }: { size: number }) {
  return (
    <motion.div
      animate={{
        x: [-6, 6, -6],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ fontSize: size * 0.7, lineHeight: 1 }}
    >
      🔍
    </motion.div>
  );
}
