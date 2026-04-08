'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GameCard from './GameCard';
import type { Game } from '@/types/game';
import { useCachedFetch } from '@/hooks/useCachedFetch';

export interface SimilarGamesProps {
  gameId: string;
}

export default function SimilarGames({ gameId }: SimilarGamesProps) {
  const { data: games, loading } = useCachedFetch<Game[]>(
    `/api/games/${encodeURIComponent(gameId)}/similar`,
    { transform: (d) => (d as { similar?: Game[] }).similar ?? [] },
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!games || games.length === 0) return null;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Similar Games
      </Typography>
      <Stack spacing={2}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </Stack>
    </Box>
  );
}
