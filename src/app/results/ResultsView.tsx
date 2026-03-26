'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GameCard from '@/components/GameCard';
import { GameCardSkeletonList } from '@/components/GameCardSkeleton';
import SignupPrompt from '@/components/SignupPrompt';
import type { Game } from '@/types/game';
import type { QuestionnaireState, TimePreset } from '@/types/questionnaire';
import type { GameType } from '@/types/game';
import { incrementRecommendCount } from '@/lib/guest';

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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularity, setPopularity] = useState<PopularityMode>('popular');
  const [engine, setEngine] = useState<string>('');
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [freeText, setFreeText] = useState(searchParams.get('freeText') ?? '');
  const [isReparsing, setIsReparsing] = useState(false);

  /**
   * Reconstructs the QuestionnaireState from URL search params
   * and calls the recommendation engine.
   */
  const fetchResults = useCallback(async (popularityOverride?: PopularityMode) => {
    setLoading(true);
    setError(null);

    try {
      // Reconstruct preferences from URL params
      let llmParsed = null;
      const llmRaw = searchParams.get('llmParsed');
      if (llmRaw) {
        try { llmParsed = JSON.parse(decodeURIComponent(llmRaw)); } catch { /* ignore */ }
      }

      const preferences: QuestionnaireState & { popularity: string; limit: number } = {
        freeText: searchParams.get('freeText') ?? '',
        gameTypes: (searchParams.get('types')?.split(',').filter(Boolean) ?? []) as GameType[],
        playerCount: {
          min: parseInt(searchParams.get('minPlayers') ?? '1', 10),
          max: parseInt(searchParams.get('maxPlayers') ?? '8', 10),
        },
        timePresets: (searchParams.get('time')?.split(',').filter(Boolean) ?? []) as TimePreset[],
        complexity: {
          min: parseFloat(searchParams.get('minComplexity') ?? '1'),
          max: parseFloat(searchParams.get('maxComplexity') ?? '5'),
        },
        genres: searchParams.get('genres')?.split(',').filter(Boolean) ?? [],
        moods: searchParams.get('moods')?.split(',').filter(Boolean) ?? [],
        llmParsed,
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

      setHasLoaded(true);

      // Track recommendation count for guest signup prompt
      if (data.results?.length > 0) {
        incrementRecommendCount();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [searchParams, popularity]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  async function saveAsPreset() {
    if (!presetName.trim()) return;
    setSaveStatus('saving');

    const preferences = {
      gameTypes: (searchParams.get('types')?.split(',').filter(Boolean) ?? []) as GameType[],
      playerCount: {
        min: parseInt(searchParams.get('minPlayers') ?? '1', 10),
        max: parseInt(searchParams.get('maxPlayers') ?? '8', 10),
      },
      timePresets: (searchParams.get('time')?.split(',').filter(Boolean) ?? []) as TimePreset[],
      complexity: {
        min: parseFloat(searchParams.get('minComplexity') ?? '1'),
        max: parseFloat(searchParams.get('maxComplexity') ?? '5'),
      },
      genres: searchParams.get('genres')?.split(',').filter(Boolean) ?? [],
      moods: searchParams.get('moods')?.split(',').filter(Boolean) ?? [],
      freeText: searchParams.get('freeText') ?? '',
    };

    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), preferences }),
      });
      if (res.status === 401) {
        setSaveStatus('error');
        return;
      }
      if (!res.ok) {
        setSaveStatus('error');
        return;
      }
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveDialogOpen(false);
        setSaveStatus('idle');
        setPresetName('');
      }, 1500);
    } catch {
      setSaveStatus('error');
    }
  }

  async function reSearch() {
    if (!freeText.trim()) return;
    setIsReparsing(true);

    // Re-parse with LLM
    let llmParsed = null;
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        llmParsed = data.parsed;
      }
    } catch { /* proceed without LLM */ }

    // Rebuild URL with new text + LLM data, keep other params
    const params = new URLSearchParams(searchParams.toString());
    params.set('freeText', freeText.trim());
    if (llmParsed) {
      params.set('llmParsed', encodeURIComponent(JSON.stringify(llmParsed)));
      // Update genre/type params from LLM if available
      if (llmParsed.gameTypes?.length) params.set('types', llmParsed.gameTypes.join(','));
      if (llmParsed.genres?.length) params.set('genres', llmParsed.genres.join(','));
      if (llmParsed.moods?.length) params.set('moods', llmParsed.moods.join(','));
      if (llmParsed.playerCount) {
        params.set('minPlayers', String(llmParsed.playerCount.min));
        params.set('maxPlayers', String(llmParsed.playerCount.max));
      }
    }

    setIsReparsing(false);
    router.push(`/results?${params.toString()}`);
  }

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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSaveDialogOpen(true)}
            >
              💾 Save Preset
            </Button>
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
              {shareCopied ? 'Link Copied!' : '🔗 Share'}
            </Button>
            <Button variant="outlined" size="small" onClick={() => router.push('/questionnaire')}>
              Start Over
            </Button>
          </Box>
        </Box>

        {/* Editable search prompt */}
        {(freeText || searchParams.get('freeText')) && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && reSearch()}
              size="small"
              fullWidth
              placeholder="Describe what you're looking for..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                },
              }}
            />
            <Button
              variant="contained"
              onClick={reSearch}
              disabled={isReparsing || !freeText.trim()}
              sx={{ minWidth: 120, whiteSpace: 'nowrap' }}
            >
              {isReparsing ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Search again'
              )}
            </Button>
          </Box>
        )}

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

        {!loading && hasLoaded && !error && games.length === 0 && (
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

      {/* Save as Preset Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>💾 Save as Preset</DialogTitle>
        <DialogContent>
          {saveStatus === 'saved' && (
            <Alert severity="success" sx={{ mb: 2 }}>Preset saved! Find it in your profile.</Alert>
          )}
          {saveStatus === 'error' && (
            <Alert severity="error" sx={{ mb: 2 }}>Failed to save. Make sure you&apos;re logged in.</Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save these preferences so you can quickly get recommendations again without answering all the questions.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Preset Name"
            placeholder="e.g., Date Night, Game Night, Quick Break"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveAsPreset()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveAsPreset}
            disabled={!presetName.trim() || saveStatus === 'saving' || saveStatus === 'saved'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Preset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Signup prompt for guest users after N recommendations */}
      <SignupPrompt />
    </Container>
  );
}
