'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
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
import { CATEGORY_OPTIONS, MECHANIC_OPTIONS, THEME_OPTIONS, PLATFORM_OPTIONS } from '@/lib/filter-options';

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterPlayers, setFilterPlayers] = useState<[number, number]>([
    parseInt(searchParams.get('minPlayers') ?? '1', 10),
    parseInt(searchParams.get('maxPlayers') ?? '10', 10),
  ]);
  const [filterTime, setFilterTime] = useState<[number, number]>([0, 300]);
  const [filterComplexity, setFilterComplexity] = useState<[number, number]>([
    parseFloat(searchParams.get('minComplexity') ?? '1'),
    parseFloat(searchParams.get('maxComplexity') ?? '5'),
  ]);
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterMechanics, setFilterMechanics] = useState<string[]>([]);
  const [filterThemes, setFilterThemes] = useState<string[]>([]);
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);

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
        limit: 100,
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

  // Client-side filtering of already-scored results
  const filteredGames = games.filter((game) => {
    // Text filter on name
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      if (!game.name.toLowerCase().includes(lower)) return false;
    }

    // Player count
    if (filterPlayers[0] > 1 || filterPlayers[1] < 10) {
      if (!game.playerCount) return false;
      if (game.playerCount.max < filterPlayers[0]) return false;
      if (game.playerCount.min > filterPlayers[1]) return false;
    }

    // Play time
    if (filterTime[0] > 0 || filterTime[1] < 300) {
      const avg = game.playTime?.average ?? game.playTime?.max ?? 0;
      if (avg < filterTime[0] || avg > filterTime[1]) return false;
    }

    // Complexity
    if (filterComplexity[0] > 1 || filterComplexity[1] < 5) {
      if (game.complexity == null) return true; // Don't exclude unknown complexity
      if (game.complexity < filterComplexity[0] || game.complexity > filterComplexity[1]) return false;
    }

    // Rating
    if (filterMinRating > 0) {
      if ((game.rating ?? 0) < filterMinRating) return false;
    }

    // Categories (game must match ALL selected)
    if (filterCategories.length > 0) {
      const gameCats = game.categories.map((c) => c.toLowerCase());
      if (!filterCategories.every((fc) => gameCats.some((gc) => gc.includes(fc.toLowerCase())))) return false;
    }

    // Mechanics (game must match ALL selected)
    if (filterMechanics.length > 0) {
      const gameMechs = game.mechanics.map((m) => m.toLowerCase());
      if (!filterMechanics.every((fm) => gameMechs.some((gm) => gm.includes(fm.toLowerCase())))) return false;
    }

    // Themes (game must match ALL selected)
    if (filterThemes.length > 0) {
      const gameThemes = game.themes.map((t) => t.toLowerCase());
      if (!filterThemes.every((ft) => gameThemes.some((gt) => gt.includes(ft.toLowerCase())))) return false;
    }

    // Platforms (game must match ANY selected)
    if (filterPlatforms.length > 0) {
      const gamePlats = game.platforms.map((p) => p.toLowerCase());
      if (!filterPlatforms.some((fp) => gamePlats.some((gp) => gp.includes(fp.toLowerCase())))) return false;
    }

    return true;
  });

  const hasActiveResultFilters = filterText.trim() ||
    filterPlayers[0] > 1 || filterPlayers[1] < 10 ||
    filterTime[0] > 0 || filterTime[1] < 300 ||
    filterComplexity[0] > 1 || filterComplexity[1] < 5 ||
    filterMinRating > 0 ||
    filterCategories.length > 0 || filterMechanics.length > 0 ||
    filterThemes.length > 0 || filterPlatforms.length > 0;

  function clearResultFilters() {
    setFilterText('');
    setFilterPlayers([1, 10]);
    setFilterTime([0, 300]);
    setFilterComplexity([1, 5]);
    setFilterMinRating(0);
    setFilterCategories([]);
    setFilterMechanics([]);
    setFilterThemes([]);
    setFilterPlatforms([]);
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
            <Button variant="outlined" size="small" onClick={() => router.push('/find-a-game')}>
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

        {/* Filter + Popularity controls */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
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
          <Box sx={{ flex: 1 }} />
          <Button
            variant={filtersOpen ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            Refine {hasActiveResultFilters ? `(${[
              filterText.trim() ? 1 : 0,
              filterPlayers[0] > 1 || filterPlayers[1] < 10 ? 1 : 0,
              filterTime[0] > 0 || filterTime[1] < 300 ? 1 : 0,
              filterComplexity[0] > 1 || filterComplexity[1] < 5 ? 1 : 0,
              filterMinRating > 0 ? 1 : 0,
              filterCategories.length > 0 ? 1 : 0,
              filterMechanics.length > 0 ? 1 : 0,
              filterThemes.length > 0 ? 1 : 0,
              filterPlatforms.length > 0 ? 1 : 0,
            ].reduce((a, b) => a + b, 0)})` : ''}
          </Button>
        </Box>

        {/* Refine filters panel */}
        <Collapse in={filtersOpen}>
          <Box sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack spacing={2.5}>
              <TextField
                size="small"
                fullWidth
                placeholder="Filter by name..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Players: {filterPlayers[0]}–{filterPlayers[1] >= 10 ? '10+' : filterPlayers[1]}
                  </Typography>
                  <Slider
                    value={filterPlayers}
                    onChange={(_, v) => setFilterPlayers(v as [number, number])}
                    min={1} max={10} step={1}
                    valueLabelDisplay="auto"
                    marks={[{ value: 1, label: '1' }, { value: 4, label: '4' }, { value: 10, label: '10+' }]}
                  />
                </Box>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Play Time: {filterTime[0]}–{filterTime[1] >= 300 ? '300+' : filterTime[1]} min
                  </Typography>
                  <Slider
                    value={filterTime}
                    onChange={(_, v) => setFilterTime(v as [number, number])}
                    min={0} max={300} step={15}
                    valueLabelDisplay="auto"
                    marks={[{ value: 0, label: '0' }, { value: 60, label: '1h' }, { value: 120, label: '2h' }, { value: 300, label: '5h+' }]}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Complexity: {filterComplexity[0]}–{filterComplexity[1]}
                  </Typography>
                  <Slider
                    value={filterComplexity}
                    onChange={(_, v) => setFilterComplexity(v as [number, number])}
                    min={1} max={5} step={0.5}
                    valueLabelDisplay="auto"
                    marks={[{ value: 1, label: 'Light' }, { value: 5, label: 'Expert' }]}
                  />
                </Box>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Min Rating: {filterMinRating > 0 ? `${filterMinRating}+` : 'Any'}
                  </Typography>
                  <Slider
                    value={filterMinRating}
                    onChange={(_, v) => setFilterMinRating(v as number)}
                    min={0} max={9} step={0.5}
                    valueLabelDisplay="auto"
                    marks={[{ value: 0, label: 'Any' }, { value: 9, label: '9+' }]}
                  />
                </Box>
              </Box>
              {/* Category, Mechanic, Theme, Platform — multi-select with chips */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filterCategories}
                  onChange={(_, v) => setFilterCategories(v)}
                  options={CATEGORY_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Categories" size="small" placeholder={filterCategories.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={3}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filterMechanics}
                  onChange={(_, v) => setFilterMechanics(v)}
                  options={MECHANIC_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Mechanics" size="small" placeholder={filterMechanics.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={3}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filterThemes}
                  onChange={(_, v) => setFilterThemes(v)}
                  options={THEME_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Themes" size="small" placeholder={filterThemes.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={3}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filterPlatforms}
                  onChange={(_, v) => setFilterPlatforms(v)}
                  options={PLATFORM_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Platforms" size="small" placeholder={filterPlatforms.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={3}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
              </Box>

              {hasActiveResultFilters && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {filteredGames.length} of {games.length} results
                  </Typography>
                  <Button size="small" onClick={clearResultFilters}>Clear filters</Button>
                </Box>
              )}
            </Stack>
          </Box>
        </Collapse>

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
              <Button variant="contained" onClick={() => router.push('/find-a-game')}>
                Try Different Preferences
              </Button>
            </Stack>
          </Box>
        )}

        {!loading && filteredGames.map((game) => (
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
