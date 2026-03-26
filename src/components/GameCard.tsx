'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';
import FavoriteButton from './FavoriteButton';

function AnimatedRating({ value, delay = 0 }: { value: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    // Delay the count-up so it starts AFTER the card's reveal animation
    const timeout = setTimeout(() => {
      const controls = animate(motionVal, value, {
        duration: 0.8,
        ease: 'easeOut',
        onUpdate: (v) => {
          if (ref.current) ref.current.textContent = v.toFixed(1);
        },
      });
      return () => controls.stop();
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, motionVal, delay]);

  return <span ref={ref}>0.0</span>;
}

export interface GameCardProps {
  game: Game;
  showFavorite?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: (gameId: string, favorited: boolean) => void;
  /** Index for staggered reveal animation (optional) */
  index?: number;
}

export default function GameCard({ game, showFavorite = true, isFavorited = false, onFavoriteToggle, index }: GameCardProps) {
  const router = useRouter();
  const details: string[] = [];
  if (game.playerCount) {
    const { min, max } = game.playerCount;
    details.push(min === max ? `${min} player${min === 1 ? '' : 's'}` : `${min}–${max} players`);
  }
  if (game.playTime?.average) {
    details.push(`${game.playTime.average} min`);
  } else if (game.playTime?.max) {
    details.push(`${game.playTime.min}–${game.playTime.max} min`);
  }
  if (game.complexity) {
    details.push(`Complexity: ${game.complexity.toFixed(1)}/5`);
  }

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate if user clicked on an interactive element inside the card
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
      return;
    }
    router.push(`/games/${encodeURIComponent(game.id)}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index != null ? Math.min(index * 0.04, 0.8) : 0,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
    <Card
      variant="outlined"
      onClick={handleCardClick}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      }}
    >
      {game.imageUrl && (
        <CardMedia
          component="img"
          image={game.imageUrl}
          alt={game.name}
          sx={{ width: { xs: '100%', sm: 140 }, height: { xs: 160, sm: 'auto' }, objectFit: 'cover' }}
        />
      )}
      <CardContent sx={{ flex: 1 }}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Typography
              variant="h6"
              fontWeight={600}
              sx={{
                flex: 1,
                '&:hover': { color: 'secondary.main' },
                transition: 'color 150ms ease',
              }}
            >
              {game.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {game.rating && (
                <Chip
                  label={<AnimatedRating value={game.rating} delay={index != null ? Math.min(index * 40, 800) + 350 : 350} />}
                  size="small"
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#FFFFFF',
                    fontWeight: 600,
                  }}
                />
              )}
              {showFavorite && (
                <FavoriteButton
                  gameId={game.id}
                  initialFavorited={isFavorited}
                  onToggle={(fav) => onFavoriteToggle?.(game.id, fav)}
                />
              )}
            </Box>
          </Box>

          {details.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {details.join(' · ')}
            </Typography>
          )}

          {game.description && (
            <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {game.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {game.types.map((t) => (
              <Chip key={t} label={formatGameType(t)} size="small" variant="outlined" />
            ))}
            {game.categories.slice(0, 3).map((c) => (
              <Chip key={c} label={c} size="small" />
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
    </motion.div>
  );
}
