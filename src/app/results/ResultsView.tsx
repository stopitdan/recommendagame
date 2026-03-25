'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GameCard from '@/components/GameCard';
import type { Game } from '@/types/game';

type PopularityMode = 'popular' | 'any' | 'hidden-gems';

export default function ResultsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popularity, setPopularity] = useState<PopularityMode>('popular');

  const fetchResults = useCallback(async (popularityOverride?: PopularityMode) => {
    setLoading(true);
    setError(null);

    try {
      const apiParams = new URLSearchParams();

      const genres = searchParams.get('genres');
      const type = searchParams.get('type');
      const freeText = searchParams.get('freeText');

      if (freeText) {
        apiParams.set('q', freeText);
      } else if (genres) {
        apiParams.set('q', genres.split(',')[0]);
      } else if (type) {
        apiParams.set('q', type === 'board' ? 'board game' : type === 'video' ? 'video game' : type);
      } else {
        apiParams.set('q', 'game');
      }

      if (type) apiParams.set('type', type);

      const minPlayers = searchParams.get('minPlayers');
      const maxPlayers = searchParams.get('maxPlayers');
      if (minPlayers) apiParams.set('minPlayers', minPlayers);
      if (maxPlayers) apiParams.set('maxPlayers', maxPlayers);

      const minComplexity = searchParams.get('minComplexity');
      const maxComplexity = searchParams.get('maxComplexity');
      if (minComplexity) apiParams.set('minComplexity', minComplexity);
      if (maxComplexity) apiParams.set('maxComplexity', maxComplexity);

      apiParams.set('popularity', popularityOverride ?? popularity);
      apiParams.set('limit', '20');

      const response = await fetch(`/api/games/search?${apiParams.toString()}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setGames(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [searchParams, popularity]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  function changePopularity(mode: PopularityMode) {
    setPopularity(mode);
    fetchResults(mode);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" fontWeight={700}>
            Your Recommendations
          </Typography>
          <Button variant="outlined" onClick={() => router.push('/questionnaire')}>
            Start Over
          </Button>
        </Box>

        {/* Popularity toggle */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
            Show:
          </Typography>
          {([
            { mode: 'popular' as const, label: 'Popular Games' },
            { mode: 'any' as const, label: 'All Games' },
            { mode: 'hidden-gems' as const, label: 'Hidden Gems' },
          ]).map(({ mode, label }) => (
            <Chip
              key={mode}
              label={label}
              onClick={() => changePopularity(mode)}
              color={popularity === mode ? 'secondary' : 'default'}
              variant={popularity === mode ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'secondary.main' }} />
          </Box>
        )}

        {error && (
          <Typography color="error" textAlign="center">
            {error}
          </Typography>
        )}

        {!loading && !error && games.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              No games found matching your preferences
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              {popularity === 'popular' && (
                <Button variant="outlined" onClick={() => changePopularity('any')}>
                  Try including all games
                </Button>
              )}
              <Button variant="contained" onClick={() => router.push('/questionnaire')}>
                Try Different Preferences
              </Button>
            </Stack>
          </Box>
        )}

        {!loading && games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </Stack>
    </Container>
  );
}
