'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import GameLoader from '@/components/GameLoader';
import SignupPrompt from '@/components/SignupPrompt';
import type { Game } from '@/types/game';
import type { QuestionnaireState, TimePreset } from '@/types/questionnaire';
import type { GameType } from '@/types/game';
import { incrementRecommendCount } from '@/lib/guest';
import { useAchievements } from '@/components/AchievementToast';
import { CATEGORY_OPTIONS, MECHANIC_OPTIONS, THEME_OPTIONS, PLATFORM_OPTIONS } from '@/lib/filter-options';
import { createClient } from '@/lib/supabase/client';
import { Save, Dice5, Puzzle, Gamepad2, Type, PartyPopper, Library } from 'lucide-react';
import ShareResultsButton from '@/components/ShareResultsButton';
import FeedbackButton from '@/components/FeedbackButton';
import LoginPromptBanner from '@/components/LoginPromptBanner';

type PopularityMode = 'any' | 'hidden-gems';

/** Game with recommendation metadata attached by the engine */
interface RecommendedGame extends Game {
  _score?: number;
  _reasons?: string[];
  _breakdown?: Record<string, number>;
}

export default function ResultsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<RecommendedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularity, setPopularity] = useState<PopularityMode>('any');
  const [engine, setEngine] = useState<string>('');
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { unlock } = useAchievements();
  const [freeText, setFreeText] = useState(searchParams.get('freeText') ?? '');
  const freeTextRef = useRef<HTMLInputElement>(null);
  const [isReparsing, setIsReparsing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [collectionOnly, setCollectionOnly] = useState(searchParams.get('collectionOnly') === '1');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  // Get logged-in user ID for rejection learning + collection filtering
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserLoaded(true);

      // Auto-sync BGG collection if stale (24h+)
      if (data.user) {
        fetch('/api/profile').then((r) => r.ok ? r.json() : null).then((profile) => {
          if (profile?.bgg_username && profile?.bgg_synced_at) {
            const lastSync = new Date(profile.bgg_synced_at).getTime();
            const hoursSinceSync = (Date.now() - lastSync) / 3600000;
            if (hoursSinceSync >= 24) {
              fetch('/api/bgg/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: profile.bgg_username }),
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
    });
  }, []);

  // Refine filters — editing state (not applied until user clicks Apply or closes panel)
  // Player slider always starts wide (1-10) since the API already filters by the user's
  // declared group size. The refine slider is for further narrowing, not restating group size.
  const initialMinPlayers = parseInt(searchParams.get('minPlayers') ?? '1', 10);
  const initialMaxPlayers = parseInt(searchParams.get('maxPlayers') ?? '10', 10);
  const [filterPlayers, setFilterPlayers] = useState<[number, number]>([initialMinPlayers, initialMaxPlayers]);
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

  // Applied filters — what was last fetched (triggers re-fetch)
  const [appliedRefine, setAppliedRefine] = useState({
    playerCount: [initialMinPlayers, initialMaxPlayers] as [number, number],
    time: [0, 300] as [number, number],
    complexity: [
      parseFloat(searchParams.get('minComplexity') ?? '1'),
      parseFloat(searchParams.get('maxComplexity') ?? '5'),
    ] as [number, number],
    minRating: 0,
    categories: [] as string[],
    mechanics: [] as string[],
    themes: [] as string[],
    platforms: [] as string[],
  });

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

      // Merge URL params with applied refine filters (refine overrides URL params)
      const r = appliedRefine;
      const urlGenres = searchParams.get('genres')?.split(',').filter(Boolean) ?? [];
      const preferences: QuestionnaireState & { popularity: string; limit: number; minRating?: number; minTime?: number; maxTime?: number; userId?: string; collectionOnly?: boolean } = {
        freeText: searchParams.get('freeText') ?? '',
        gameTypes: (searchParams.get('types')?.split(',').filter(Boolean) ?? []) as GameType[],
        playerCount: {
          min: r.playerCount[0],
          max: r.playerCount[1],
        },
        timePresets: (searchParams.get('time')?.split(',').filter(Boolean) ?? []) as TimePreset[],
        complexity: {
          min: r.complexity[0],
          max: r.complexity[1],
        },
        genres: [...new Set([...urlGenres, ...r.categories, ...r.mechanics, ...r.themes])],
        moods: searchParams.get('moods')?.split(',').filter(Boolean) ?? [],
        llmParsed,
        popularity: popularityOverride ?? popularity,
        limit: 100,
        minRating: r.minRating > 0 ? r.minRating : undefined,
        minTime: r.time[0] > 0 ? r.time[0] : undefined,
        maxTime: r.time[1] < 300 ? r.time[1] : undefined,
        userId: userId ?? undefined,
        collectionOnly: collectionOnly || undefined,
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

      // Show message if collection is empty
      if (data.collectionEmpty && data.message) {
        setError(data.message);
      }

      setHasLoaded(true);

      // Track recommendation count for guest signup prompt
      if (data.results?.length > 0) {
        incrementRecommendCount();

        // Discovery achievements
        const currentYear = new Date().getFullYear();
        for (const g of data.results) {
          if (g.yearPublished && g.yearPublished < 1980) unlock('time_traveler');
          if (g.yearPublished && g.yearPublished < 1990) unlock('retro_gamer');
          if (g.yearPublished && g.yearPublished >= currentYear) unlock('cutting_edge');
        }
      }

      // Hidden gems mode
      if ((popularityOverride ?? popularity) === 'hidden-gems') unlock('deep_diver');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [searchParams, popularity, appliedRefine, userId, collectionOnly]);

  useEffect(() => {
    // Wait for user auth to resolve before fetching so collectionOnly has userId
    if (!userLoaded) return;
    fetchResults();
  }, [fetchResults, userLoaded]);

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
    const text = freeTextRef.current?.value?.trim() ?? freeText.trim();
    if (!text) return;
    setFreeText(text);
    setIsReparsing(true);

    // Re-parse with LLM
    let llmParsed = null;
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        llmParsed = data.parsed;
      }
    } catch { /* proceed without LLM */ }

    // Rebuild URL with new text + LLM data, keep other params
    const params = new URLSearchParams(searchParams.toString());
    params.set('freeText', text);
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

  /** Apply refine filters — triggers a re-fetch with new constraints */
  function applyRefineFilters() {
    setAppliedRefine({
      playerCount: filterPlayers,
      time: filterTime,
      complexity: filterComplexity,
      minRating: filterMinRating,
      categories: filterCategories,
      mechanics: filterMechanics,
      themes: filterThemes,
      platforms: filterPlatforms,
    });
  }

  const hasActiveResultFilters =
    filterPlayers[0] > 1 || filterPlayers[1] < 10 ||
    filterTime[0] > 0 || filterTime[1] < 300 ||
    filterComplexity[0] > 1 || filterComplexity[1] < 5 ||
    filterMinRating > 0 ||
    filterCategories.length > 0 || filterMechanics.length > 0 ||
    filterThemes.length > 0 || filterPlatforms.length > 0;

  function clearResultFilters() {
    setFilterPlayers([1, 10]);
    setFilterTime([0, 300]);
    setFilterComplexity([1, 5]);
    setFilterMinRating(0);
    setFilterCategories([]);
    setFilterMechanics([]);
    setFilterThemes([]);
    setFilterPlatforms([]);
    setAppliedRefine({
      playerCount: [1, 10],
      time: [0, 300],
      complexity: [1, 5],
      minRating: 0,
      categories: [],
      mechanics: [],
      themes: [],
      platforms: [],
    });
  }

  /** Dismiss a game — hide it from results and record negative feedback */
  function handleDismiss(gameId: string) {
    setDismissedIds((prev) => new Set(prev).add(gameId));
  }

  /** "More Like This" — navigate to results seeded with this game's attributes */
  function handleMoreLikeThis(gameId: string) {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    const params = new URLSearchParams();
    params.set('freeText', `Games similar to ${game.name}`);
    if (game.types.length > 0) params.set('types', game.types.join(','));
    const genres = [...game.categories.slice(0, 3), ...game.mechanics.slice(0, 2)];
    if (genres.length > 0) params.set('genres', genres.join(','));

    router.push(`/results?${params.toString()}`);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <LoginPromptBanner />

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
              <Save size={14} /> Save Preset
            </Button>
            <ShareResultsButton gameNames={games.map((g) => g.name)} />
            <Button variant="outlined" size="small" onClick={() => router.push('/find-a-game')}>
              Start Over
            </Button>
          </Box>
        </Box>

        {/* Editable search prompt */}
        {(freeText || searchParams.get('freeText')) && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              defaultValue={freeText}
              inputRef={freeTextRef}
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
              disabled={isReparsing}
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

        {/* Game type quick filters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {([
            { label: 'All', value: null, icon: <Dice5 size={14} /> },
            { label: 'Board', value: 'board', icon: <Puzzle size={14} /> },
            { label: 'Video', value: 'video', icon: <Gamepad2 size={14} /> },
            { label: 'Word', value: 'word', icon: <Type size={14} /> },
            { label: 'Party', value: 'party', icon: <PartyPopper size={14} /> },
          ] as const).map((t) => {
            const currentTypes = searchParams.get('types')?.split(',') ?? [];
            const isActive = t.value === null
              ? currentTypes.length === 0
              : currentTypes.includes(t.value);
            return (
              <Chip
                key={t.label}
                icon={t.icon as React.ReactElement}
                label={t.label}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (t.value) {
                    params.set('types', t.value);
                  } else {
                    params.delete('types');
                  }
                  router.push(`/results?${params.toString()}`);
                }}
                color={isActive ? 'primary' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                size="small"
              />
            );
          })}
          {userId && (
            <Chip
              icon={<Library size={14} /> as React.ReactElement}
              label="My Collection"
              onClick={() => setCollectionOnly(!collectionOnly)}
              color={collectionOnly ? 'secondary' : 'default'}
              variant={collectionOnly ? 'filled' : 'outlined'}
              size="small"
              sx={{ transition: 'all 200ms' }}
            />
          )}
        </Box>

        {/* Popularity controls */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
            Show:
          </Typography>
          {([
            { mode: 'any' as const, label: 'All' },
            { mode: 'hidden-gems' as const, label: 'Hidden Gems' },
          ]).map(({ mode, label }) => (
            <Chip
              key={mode}
              label={label}
              onClick={() => changePopularity(mode)}
              color={popularity === mode ? 'secondary' : 'default'}
              variant={popularity === mode ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            variant={filtersOpen ? 'contained' : 'outlined'}
            size="small"
            onClick={() => {
              if (filtersOpen) {
                // Only refetch if filters actually changed
                const pending = {
                  playerCount: filterPlayers,
                  time: filterTime,
                  complexity: filterComplexity,
                  minRating: filterMinRating,
                  categories: filterCategories,
                  mechanics: filterMechanics,
                  themes: filterThemes,
                  platforms: filterPlatforms,
                };
                if (JSON.stringify(pending) !== JSON.stringify(appliedRefine)) {
                  applyRefineFilters();
                }
              }
              setFiltersOpen(!filtersOpen);
            }}
          >
            Refine {hasActiveResultFilters ? `(${[
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

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  size="small"
                  onClick={clearResultFilters}
                  disabled={!hasActiveResultFilters}
                >
                  Clear all filters
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => { applyRefineFilters(); setFiltersOpen(false); }}
                >
                  Apply Filters
                </Button>
              </Box>
            </Stack>
          </Box>
        </Collapse>

        {/* Client-side name filter — search within loaded results */}
        {!loading && games.length > 0 && (
          <TextField
            size="small"
            fullWidth
            placeholder="Search within results..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
            }}
          />
        )}

        {loading && (
          <GameLoader variant="search" message="Finding your perfect games..." />
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
              {popularity === 'hidden-gems' && (
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

        {!loading && games
          .filter((game) => !dismissedIds.has(game.id))
          .filter((game) => !nameFilter.trim() || game.name.toLowerCase().includes(nameFilter.toLowerCase()))
          .map((game, i) => (
          <Box key={game.id}>
            <GameCard
              game={game}
              index={i}
              showActions
              onDismiss={handleDismiss}
              onMoreLikeThis={handleMoreLikeThis}
            />
            {/* "Why we picked this" reasons + match score */}
            {(game._reasons?.length || game._score) && (
              <Box sx={{ px: 2, pb: 1, mt: -0.5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  {game._score != null && (
                    <Chip
                      label={`${Math.round(game._score * 100)}% match`}
                      size="small"
                      sx={{
                        bgcolor: game._score >= 0.7 ? 'success.main'
                          : game._score >= 0.4 ? 'warning.main'
                          : 'text.disabled',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  )}
                  {game._reasons?.map((reason, i) => (
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
        <DialogTitle sx={{ fontWeight: 700 }}>Save as Preset</DialogTitle>
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

      {/* Subtle feedback at bottom */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
        <FeedbackButton />
      </Box>
    </Container>
  );
}
