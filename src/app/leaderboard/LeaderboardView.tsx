'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';
import type { Game } from '@/types/game';
import GameCard from '@/components/GameCard';

type TypeFilter = 'all' | 'board' | 'video' | 'word';

export default function LeaderboardView() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const fetchLeaderboard = useCallback(async (type: TypeFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (type !== 'all') params.set('type', type);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      const mapped = (data.games ?? []).map((row: GameRow) => rowToGame(row));
      setGames(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(typeFilter);
  }, [typeFilter, fetchLeaderboard]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>
          Leaderboard
        </Typography>

        {/* Type filter */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {([
            { value: 'all' as const, label: 'All Games' },
            { value: 'board' as const, label: 'Board Games' },
            { value: 'video' as const, label: 'Video Games' },
            { value: 'word' as const, label: 'Word Games' },
          ]).map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              onClick={() => setTypeFilter(value)}
              color={typeFilter === value ? 'secondary' : 'default'}
              variant={typeFilter === value ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'secondary.main' }} />
          </Box>
        )}

        {!loading && games.length === 0 && (
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 8 }}>
            No games found for this category yet.
          </Typography>
        )}

        {!loading && games.map((game, index) => (
          <Box key={game.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                minWidth: 40,
                color: index < 3 ? 'secondary.main' : 'text.secondary',
                pt: 2,
              }}
            >
              {index + 1}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <GameCard game={game} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Container>
  );
}
