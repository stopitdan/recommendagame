'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Game } from '@/types/game';
import FavoriteButton from './FavoriteButton';

export interface GameCardProps {
  game: Game;
  showFavorite?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: (gameId: string, favorited: boolean) => void;
}

export default function GameCard({ game, showFavorite = true, isFavorited = false, onFavoriteToggle }: GameCardProps) {
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

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
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
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
              {game.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {game.rating && (
                <Chip
                  label={game.rating.toFixed(1)}
                  size="small"
                  sx={{
                    bgcolor: '#3A4F41',
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
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
            {game.categories.slice(0, 3).map((c) => (
              <Chip key={c} label={c} size="small" />
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
