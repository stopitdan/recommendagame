'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GameCard from './GameCard';
import type { Game } from '@/types/game';

export interface SimilarGamesProps {
  gameId: string;
}

export default function SimilarGames({ gameId }: SimilarGamesProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilar() {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/similar`);
        if (!res.ok) return;
        const data = await res.json();
        setGames(data.similar ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchSimilar();
  }, [gameId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (games.length === 0) return null;

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
