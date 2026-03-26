'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GameCard from '@/components/GameCard';
import type { Game } from '@/types/game';
import { rowToGame } from '@/lib/supabase/games';
import type { GameRow } from '@/types/supabase';

export default function FavoritesView() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/favorites');
      if (res.status === 401) {
        setError('Log in to see your favorites');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch favorites');

      const data = await res.json();
      const favoriteGames = (data.favorites ?? [])
        .filter((f: any) => f.games)
        .map((f: any) => rowToGame(f.games as GameRow));

      setGames(favoriteGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  function handleFavoriteToggle(gameId: string, favorited: boolean) {
    if (!favorited) {
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" fontWeight={700}>
            My Favorites
          </Typography>
          <Button variant="contained" onClick={() => router.push('/find-a-game')}>
            Find More Games
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'secondary.main' }} />
          </Box>
        )}

        {error && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              {error}
            </Typography>
            {error.includes('Log in') && (
              <Button variant="contained" onClick={() => router.push('/login')}>
                Log In
              </Button>
            )}
          </Box>
        )}

        {!loading && !error && games.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No favorites yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Find games you love and tap the heart to save them here.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/find-a-game')}>
              Find Games
            </Button>
          </Box>
        )}

        {!loading && !error && games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            isFavorited
            onFavoriteToggle={handleFavoriteToggle}
          />
        ))}
      </Stack>
    </Container>
  );
}
