'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { motion } from 'motion/react';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';
import { getPrimaryTypeConfig } from '@/lib/game-type-config';
import { Puzzle, Gamepad2, Type, PartyPopper } from 'lucide-react';
import BuyOptions from './BuyOptions';
import Tooltip from '@mui/material/Tooltip';
import AnimatedRating from './AnimatedRating';
import FavoriteButton from './FavoriteButton';
import GameCardActions from './GameCardActions';

export interface GameCardProps {
  game: Game;
  showFavorite?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: (gameId: string, favorited: boolean) => void;
  /** Show "Not This" and "More Like This" action buttons */
  showActions?: boolean;
  onDismiss?: (gameId: string) => void;
  onMoreLikeThis?: (gameId: string) => void;
  /** Index for staggered reveal animation (optional) */
  index?: number;
  /** Recommendation reasons to show below description */
  reasons?: string[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  board: <Puzzle size={14} />,
  video: <Gamepad2 size={14} />,
  word: <Type size={14} />,
  party: <PartyPopper size={14} />,
  card: <Puzzle size={14} />,
};

export default function GameCard({ game, showFavorite = true, isFavorited = false, onFavoriteToggle, showActions = false, onDismiss, onMoreLikeThis, index, reasons }: GameCardProps) {
  const router = useRouter();
  const typeConfig = getPrimaryTypeConfig(game.types);
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
        position: 'relative',
        borderLeft: `4px solid ${typeConfig.color}`,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? typeConfig.tintDark : typeConfig.tintLight,
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: `0 6px 20px ${typeConfig.color}22`,
          transform: 'translateY(-2px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      }}
    >
      {/* Game type icon badge — pinned to image area so it doesn't overlap content icons */}
      <Tooltip title={typeConfig.label} arrow>
        <Box
          aria-label={typeConfig.label}
          sx={{
            position: 'absolute',
            top: 8,
            left: { xs: 'auto', sm: 8 },
            right: { xs: 8, sm: 'auto' },
            zIndex: 1,
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: typeConfig.color,
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
            transition: 'opacity 150ms ease',
            '&:hover': { opacity: 1 },
          }}
        >
          {TYPE_ICONS[game.types[0]] ?? TYPE_ICONS.board}
        </Box>
      </Tooltip>
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
              {showActions && (
                <GameCardActions
                  gameId={game.id}
                  onDismiss={onDismiss}
                  onMoreLikeThis={onMoreLikeThis}
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

          {reasons && reasons.length > 0 && (
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', lineHeight: 1.4 }}>
              {reasons.slice(0, 2).join(' · ')}
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
            {game.categories.slice(0, 4).map((c) => (
              <Chip key={c} label={c} size="small" />
            ))}
            <BuyOptions game={game}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
    </motion.div>
  );
}
