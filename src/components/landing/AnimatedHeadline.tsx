'use client';

import { motion } from 'motion/react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

/**
 * Word-by-word spring animation headline.
 * Each word drops in with bounce physics and slight rotation.
 */

function AnimatedWord({ word, index, color }: { word: string; index: number; color?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 80, rotateX: -90, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
      transition={{
        delay: 0.3 + index * 0.12,
        duration: 0.8,
        type: 'spring',
        stiffness: 100,
        damping: 12,
      }}
      style={{
        display: 'inline-block',
        marginRight: '0.25em',
        color: color ?? 'inherit',
        perspective: 600,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {word}
    </motion.span>
  );
}

export default function AnimatedHeadline() {
  const theme = useTheme();

  const line1 = ['Find', 'your', 'next'];
  const line2 = ['favorite', 'game'];

  return (
    <Typography
      variant="h1"
      component="h1"
      sx={{
        fontWeight: 900,
        fontSize: { xs: '2.8rem', sm: '3.8rem', md: '5rem' },
        letterSpacing: '-0.04em',
        lineHeight: 1.05,
        color: 'primary.main',
      }}
    >
      <Box component="span" sx={{ display: 'block' }}>
        {line1.map((word, i) => (
          <AnimatedWord key={word} word={word} index={i} />
        ))}
      </Box>
      <Box component="span" sx={{ display: 'block', position: 'relative' }}>
        {line2.map((word, i) => (
          <AnimatedWord
            key={word}
            word={word}
            index={i + line1.length}
            color={theme.palette.secondary.main}
          />
        ))}
        {/* Animated underline */}
        <motion.span
          style={{
            position: 'absolute',
            bottom: -4,
            left: 0,
            right: 0,
            height: '0.1em',
            background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.info.main})`,
            borderRadius: 4,
            display: 'block',
            transformOrigin: 'left',
            zIndex: 0,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </Box>
    </Typography>
  );
}
