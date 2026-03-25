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
import { GameCardSkeletonList } from '@/components/GameCardSkeleton';
import type { Game } from '@/types/game';
import type { QuestionnaireState, TimePreset } from '@/types/questionnaire';

type PopularityMode = 'popular' | 'any' | 'hidden-gems';

/** Game with recommendation metadata attached by the engine */
interface RecommendedGame extends Game {
  _score?: number;
  _reasons?: string[];
}

export default function ResultsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<RecommendedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popularity, setPopularity] = useState<PopularityMode>('popular');
  const [engine, setEngine] = useState<string>('');
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  /**
   * Reconstructs the QuestionnaireState from URL search params
   * and calls the recommendation engine.
   */
  const fetchResults = useCallback(async (popularityOverride?: PopularityMode) => {
    setLoading(true);
    setError(null);

    try {
      // Reconstruct preferences from URL params
      const preferences: QuestionnaireState & { popularity: string; limit: number } = {
        gameType: searchParams.get('type') as QuestionnaireState['gameType'],
        playerCount: {
          min: parseInt(searchParams.get('minPlayers') ?? '1', 10),
          max: parseInt(searchParams.get('maxPlayers') ?? '8', 10),
        },
        timeAvailable: (searchParams.get('time') as TimePreset) ?? null,
        complexity: {
          min: parseFloat(searchParams.get('minComplexity') ?? '1'),
          max: parseFloat(searchParams.get('maxComplexity') ?? '5'),
        },
        genres: searchParams.get('genres')?.split(',').filter(Boolean) ?? [],
        moods: searchParams.get('moods')?.split(',').filter(Boolean) ?? [],
        freeText: searchParams.get('freeText') ?? '',
        popularity: popularityOverride ?? popularity,
        limit: 20,
      };

      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) throw new Error('Recommendation failed');

      const data = await response.json();
      setGames(data.results ?? []);
      setEngine(data.engine ?? '');
      setTotalCandidates(data.totalCandidates ?? 0);
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
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Your Recommendations
            </Typography>
            {engine && totalCandidates > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Scored {totalCandidates} games to find your best matches
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                });
              }}
            >
              {shareCopied ? 'Link Copied!' : 'Share Results'}
            </Button>
            <Button variant="outlined" onClick={() => router.push('/questionnaire')}>
              Start Over
            </Button>
          </Box>
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
          <Box sx={{ py: 2 }}>
            <GameCardSkeletonList count={5} />
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
          <Box key={game.id}>
            <GameCard game={game} />
            {/* "Why we picked this" reasons */}
            {game._reasons && game._reasons.length > 0 && (
              <Box sx={{ px: 2, pb: 1, mt: -0.5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {game._reasons.map((reason, i) => (
                    <Chip
                      key={i}
                      label={reason}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: 'info.main',
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Container>
  );
}
