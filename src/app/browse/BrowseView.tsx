'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Dice5, Puzzle, Gamepad2, Type, PartyPopper } from 'lucide-react';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import FeedbackButton from '@/components/FeedbackButton';
import GameCard from '@/components/GameCard';
import { GameCardSkeletonList } from '@/components/GameCardSkeleton';
import GameLoader from '@/components/GameLoader';
import type { Game, GameType } from '@/types/game';
import { getGameTypeConfig } from '@/lib/game-type-config';
import { CATEGORY_OPTIONS, MECHANIC_OPTIONS, THEME_OPTIONS, PLATFORM_OPTIONS } from '@/lib/filter-options';
import { useAchievements } from '@/components/AchievementToast';
import JsonLd from '@/components/JsonLd';

const PAGE_SIZE = 20;

// ─── Filter State ────────────────────────────────────────────

interface Filters {
  type: string | null;
  categories: string[];
  mechanics: string[];
  themes: string[];
  platforms: string[];
  designers: string[];
  publishers: string[];
  q: string;
  sort: string;
  popularity: string;
  playerCount: [number, number];
  playTime: [number, number];
  complexity: [number, number];
  minRating: number;
  yearRange: [number, number];
}

const DEFAULT_FILTERS: Filters = {
  type: null,
  categories: [],
  mechanics: [],
  themes: [],
  platforms: [],
  designers: [],
  publishers: [],
  q: '',
  sort: 'popularity',
  popularity: 'popular',
  playerCount: [1, 10],
  playTime: [0, 300],
  complexity: [1, 5],
  minRating: 0,
  yearRange: [1950, 2026],
};

const COMPLEXITY_LABELS: Record<number, string> = {
  1: 'Light',
  2: 'Easy',
  3: 'Medium',
  4: 'Heavy',
  5: 'Expert',
};

// ─── Component ───────────────────────────────────────────────

export default function BrowseView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false); // True after first successful fetch
  const [fuzzyHint, setFuzzyHint] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalBrowsed, setTotalBrowsed] = useState(0);
  const { unlock } = useAchievements();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // `filters` = what's being edited in the panel (not yet applied)
  // `appliedFilters` = what was last fetched (triggers API calls)
  const initialFilters: Filters = {
    ...DEFAULT_FILTERS,
    type: searchParams.get('type'),
    categories: searchParams.get('category') ? [searchParams.get('category')!] : [],
    mechanics: searchParams.get('mechanic') ? [searchParams.get('mechanic')!] : [],
    themes: searchParams.get('theme') ? [searchParams.get('theme')!] : [],
    platforms: searchParams.get('platform') ? [searchParams.get('platform')!] : [],
    designers: searchParams.get('designer') ? [searchParams.get('designer')!] : [],
    publishers: searchParams.get('publisher') ? [searchParams.get('publisher')!] : [],
    q: searchParams.get('q') ?? '',
  };

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  function updateFilter(partial: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  /** Apply the current filters and fetch results */
  function applyFilters() {
    setAppliedFilters({ ...filters });
  }

  /** Update a filter AND apply immediately (for controls outside the panel) */
  function updateAndApply(partial: Partial<Filters>) {
    const updated = { ...filters, ...partial };
    setFilters(updated);
    setAppliedFilters(updated);
  }

  const fetchGames = useCallback(async (newOffset: number = 0) => {
    setLoading(true);
    try {
      const f = appliedFilters;
      const params = new URLSearchParams();
      // Send first value of each array filter (API handles one at a time)
      // For multi-select, the client-side post-filters handle the rest
      if (f.categories.length > 0) params.set('category', f.categories[0]);
      if (f.mechanics.length > 0) params.set('mechanic', f.mechanics[0]);
      if (f.themes.length > 0) params.set('theme', f.themes[0]);
      if (f.platforms.length > 0) params.set('platform', f.platforms[0]);
      if (f.designers.length > 0) params.set('designer', f.designers[0]);
      if (f.publishers.length > 0) params.set('publisher', f.publishers[0]);
      if (f.type) params.set('type', f.type);
      if (f.q.trim()) params.set('q', f.q.trim());
      params.set('sort', f.sort);
      params.set('popularity', f.popularity);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(newOffset));

      if (f.playerCount[0] > 1) params.set('minPlayers', String(f.playerCount[0]));
      if (f.playerCount[1] < 10) params.set('maxPlayers', String(f.playerCount[1]));
      if (f.playTime[0] > 0) params.set('minTime', String(f.playTime[0]));
      if (f.playTime[1] < 300) params.set('maxTime', String(f.playTime[1]));
      if (f.complexity[0] > 1) params.set('minComplexity', String(f.complexity[0]));
      if (f.complexity[1] < 5) params.set('maxComplexity', String(f.complexity[1]));
      if (f.minRating > 0) params.set('minRating', String(f.minRating));
      if (f.yearRange[0] > 1950) params.set('yearFrom', String(f.yearRange[0]));
      if (f.yearRange[1] < 2026) params.set('yearTo', String(f.yearRange[1]));

      const res = await fetch(`/api/games/browse?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const rawGames: Game[] = data.games ?? [];
      // Dedupe by ID — the interleaving API path can return the same game
      // from multiple type buckets; cached responses may also carry dupes.
      const seen = new Set<string>();
      const newGames = rawGames.filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      setGames(newGames);
      setTotal(data.total ?? 0);
      setFuzzyHint(data.fuzzyMatch ? data.correctedQuery : null);
      setOffset(newOffset);
      setHasLoaded(true);
      setTotalBrowsed((prev) => {
        const next = prev + newGames.length;
        if (next >= 50) unlock('explorer');
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchGames(0);
  }, [fetchGames]);

  function clearAllFilters() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    router.push('/browse');
  }

  const af = appliedFilters; // shorthand for active filter checks
  const hasActiveFilters = af.type ||
    af.categories.length > 0 || af.mechanics.length > 0 ||
    af.themes.length > 0 || af.platforms.length > 0 ||
    af.designers.length > 0 || af.publishers.length > 0 || af.q.trim() ||
    af.playerCount[0] > 1 || af.playerCount[1] < 10 ||
    af.playTime[0] > 0 || af.playTime[1] < 300 ||
    af.complexity[0] > 1 || af.complexity[1] < 5 ||
    af.minRating > 0 ||
    af.yearRange[0] > 1950 || af.yearRange[1] < 2026;

  const activeFilterCount = [
    af.type,
    af.categories.length > 0 ? 'cat' : null,
    af.mechanics.length > 0 ? 'mech' : null,
    af.themes.length > 0 ? 'theme' : null,
    af.platforms.length > 0 ? 'plat' : null,
    af.designers.length > 0 ? 'des' : null,
    af.publishers.length > 0 ? 'pub' : null,
    af.q.trim() || null,
    af.playerCount[0] > 1 || af.playerCount[1] < 10 ? 'players' : null,
    af.playTime[0] > 0 || af.playTime[1] < 300 ? 'time' : null,
    af.complexity[0] > 1 || af.complexity[1] < 5 ? 'complexity' : null,
    af.minRating > 0 ? 'rating' : null,
    af.yearRange[0] > 1950 || af.yearRange[1] < 2026 ? 'year' : null,
  ].filter(Boolean).length;

  const hasMore = offset + PAGE_SIZE < total;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Browse Games',
        description: 'Browse and filter 80,000+ board games, video games, word games, and party games. Filter by category, mechanic, player count, complexity, and more.',
        url: 'https://boredgame.lol/browse',
        isPartOf: { '@type': 'WebSite', name: 'boredgame.lol', url: 'https://boredgame.lol' },
      }} />
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Browse Games
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {total.toLocaleString()} games found
          </Typography>
        </Box>

        {/* Quick type filters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {([
            { label: 'All', value: null as string | null, icon: <Dice5 size={14} /> },
            { label: 'Board Games', value: 'board' as string | null, icon: <Puzzle size={14} /> },
            { label: 'Video Games', value: 'video' as string | null, icon: <Gamepad2 size={14} /> },
            { label: 'Word Games', value: 'word' as string | null, icon: <Type size={14} /> },
            { label: 'Party Games', value: 'party' as string | null, icon: <PartyPopper size={14} /> },
          ]).map((t) => {
            const isActive = af.type === t.value || (!af.type && !t.value);
            const typeColor = t.value ? getGameTypeConfig(t.value as GameType).color : undefined;
            return (
              <Chip
                key={t.label}
                icon={t.icon as React.ReactElement}
                label={t.label}
                onClick={() => updateAndApply({ type: t.value })}
                variant={isActive ? 'filled' : 'outlined'}
                sx={{
                  transition: 'all 200ms ease',
                  ...(isActive && typeColor ? {
                    bgcolor: typeColor,
                    color: '#FFFFFF',
                    borderColor: typeColor,
                    '&:hover': { bgcolor: typeColor, opacity: 0.9 },
                  } : {}),
                }}
              />
            );
          })}
        </Box>

        {/* Search + Sort + Filter toggle */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchAutocomplete
            value={filters.q}
            onChange={(q) => updateFilter({ q })}
            onSubmit={applyFilters}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={filters.sort}
              label="Sort by"
              onChange={(e) => updateAndApply({ sort: e.target.value })}
            >
              <MenuItem value="rating">Rating</MenuItem>
              <MenuItem value="popularity">Most Popular</MenuItem>
              <MenuItem value="name">Name (A-Z)</MenuItem>
              <MenuItem value="year">Newest First</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant={filtersOpen ? 'contained' : 'outlined'}
            size="medium"
            onClick={() => {
              if (filtersOpen) {
                // Only refetch if filters actually changed
                if (JSON.stringify(filters) !== JSON.stringify(appliedFilters)) {
                  applyFilters();
                }
              }
              setFiltersOpen(!filtersOpen);
            }}
            sx={{ minWidth: 120 }}
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
        </Box>

        {/* Expanded filter panel */}
        <Collapse in={filtersOpen}>
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={3}>
              {/* Row 1: Players + Play Time */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Players: {filters.playerCount[0]}–{filters.playerCount[1] >= 10 ? '10+' : filters.playerCount[1]}
                  </Typography>
                  <Slider
                    value={filters.playerCount}
                    onChange={(_, v) => updateFilter({ playerCount: v as [number, number] })}
                    min={1}
                    max={10}
                    step={1}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: '1' },
                      { value: 4, label: '4' },
                      { value: 10, label: '10+' },
                    ]}
                  />
                </Box>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Play Time: {filters.playTime[0]}–{filters.playTime[1] >= 300 ? '300+' : filters.playTime[1]} min
                  </Typography>
                  <Slider
                    value={filters.playTime}
                    onChange={(_, v) => updateFilter({ playTime: v as [number, number] })}
                    min={0}
                    max={300}
                    step={15}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: '0' },
                      { value: 60, label: '1h' },
                      { value: 120, label: '2h' },
                      { value: 300, label: '5h+' },
                    ]}
                  />
                </Box>
              </Box>

              {/* Row 2: Complexity + Rating */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Complexity: {COMPLEXITY_LABELS[filters.complexity[0]] ?? filters.complexity[0]}–{COMPLEXITY_LABELS[filters.complexity[1]] ?? filters.complexity[1]}
                  </Typography>
                  <Slider
                    value={filters.complexity}
                    onChange={(_, v) => updateFilter({ complexity: v as [number, number] })}
                    min={1}
                    max={5}
                    step={0.5}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: 'Light' },
                      { value: 5, label: 'Expert' },
                    ]}
                  />
                </Box>
                <Box sx={{ px: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Minimum Rating: {filters.minRating > 0 ? `${filters.minRating}+` : 'Any'}
                  </Typography>
                  <Slider
                    value={filters.minRating}
                    onChange={(_, v) => updateFilter({ minRating: v as number })}
                    min={0}
                    max={9}
                    step={0.5}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: 'Any' },
                      { value: 9, label: '9+' },
                    ]}
                  />
                </Box>
              </Box>

              {/* Row 3: Year range */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Year Published: {filters.yearRange[0]}–{filters.yearRange[1]}
                </Typography>
                <Slider
                  value={filters.yearRange}
                  onChange={(_, v) => updateFilter({ yearRange: v as [number, number] })}
                  min={1950}
                  max={2026}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 1950, label: '1950' },
                    { value: 1980, label: '80' },
                    { value: 2000, label: '2000' },
                    { value: 2010, label: '10' },
                    { value: 2020, label: '20' },
                    { value: 2026, label: '26' },
                  ]}
                />
              </Box>

              {/* Row 4: Category + Mechanic + Theme — multi-select */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 3 }}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filters.categories}
                  onChange={(_, v) => updateFilter({ categories: v })}
                  options={CATEGORY_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Categories" size="small" placeholder={filters.categories.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filters.mechanics}
                  onChange={(_, v) => updateFilter({ mechanics: v })}
                  options={MECHANIC_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Mechanics" size="small" placeholder={filters.mechanics.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filters.themes}
                  onChange={(_, v) => updateFilter({ themes: v })}
                  options={THEME_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Themes" size="small" placeholder={filters.themes.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
              </Box>

              {/* Row 5: Platform + Designer + Publisher — multi-select */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 3 }}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  value={filters.platforms}
                  onChange={(_, v) => updateFilter({ platforms: v })}
                  options={PLATFORM_OPTIONS}
                  renderInput={(params) => <TextField {...params} label="Platforms" size="small" placeholder={filters.platforms.length ? '' : 'Add...'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  freeSolo
                  value={filters.designers}
                  onChange={(_, v) => updateFilter({ designers: v as string[] })}
                  options={[]}
                  renderInput={(params) => <TextField {...params} label="Designers" size="small" placeholder={filters.designers.length ? '' : 'e.g. Reiner Knizia'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  freeSolo
                  value={filters.publishers}
                  onChange={(_, v) => updateFilter({ publishers: v as string[] })}
                  options={[]}
                  renderInput={(params) => <TextField {...params} label="Publishers" size="small" placeholder={filters.publishers.length ? '' : 'e.g. Fantasy Flight'} />}
                  size="small"
                  limitTags={2}
                  ChipProps={{ size: 'small', variant: 'outlined' }}
                />
              </Box>

              {/* Row 6: Popularity mode */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Show
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { value: 'popular', label: 'Popular Games' },
                    { value: 'any', label: 'All Games' },
                    { value: 'hidden-gems', label: 'Hidden Gems' },
                  ].map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      onClick={() => updateFilter({ popularity: opt.value })}
                      color={filters.popularity === opt.value ? 'secondary' : 'default'}
                      variant={filters.popularity === opt.value ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Box>

              <Divider />

              {/* Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="text" onClick={clearAllFilters} disabled={!hasActiveFilters}>
                  Clear all filters
                </Button>
                <Button variant="contained" onClick={() => { applyFilters(); setFiltersOpen(false); }}>
                  Apply Filters
                </Button>
              </Box>
            </Stack>
          </Box>
        </Collapse>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {af.categories.map((c) => (
              <Chip key={`cat-${c}`} label={`Category: ${c}`} onDelete={() => updateAndApply({ categories: af.categories.filter((x) => x !== c) })} size="small" color="secondary" />
            ))}
            {af.mechanics.map((m) => (
              <Chip key={`mech-${m}`} label={`Mechanic: ${m}`} onDelete={() => updateAndApply({ mechanics: af.mechanics.filter((x) => x !== m) })} size="small" color="secondary" />
            ))}
            {af.themes.map((t) => (
              <Chip key={`theme-${t}`} label={`Theme: ${t}`} onDelete={() => updateAndApply({ themes: af.themes.filter((x) => x !== t) })} size="small" color="secondary" />
            ))}
            {af.platforms.map((p) => (
              <Chip key={`plat-${p}`} label={`Platform: ${p}`} onDelete={() => updateAndApply({ platforms: af.platforms.filter((x) => x !== p) })} size="small" color="secondary" />
            ))}
            {af.designers.map((d) => (
              <Chip key={`des-${d}`} label={`Designer: ${d}`} onDelete={() => updateAndApply({ designers: af.designers.filter((x) => x !== d) })} size="small" color="secondary" />
            ))}
            {af.publishers.map((p) => (
              <Chip key={`pub-${p}`} label={`Publisher: ${p}`} onDelete={() => updateAndApply({ publishers: af.publishers.filter((x) => x !== p) })} size="small" color="secondary" />
            ))}
            {(af.playerCount[0] > 1 || af.playerCount[1] < 10) && (
              <Chip
                label={`${af.playerCount[0]}–${af.playerCount[1]}${af.playerCount[1] >= 10 ? '+' : ''} players`}
                onDelete={() => updateAndApply({ playerCount: [1, 10] })}
                size="small"
                variant="outlined"
              />
            )}
            {(af.playTime[0] > 0 || af.playTime[1] < 300) && (
              <Chip
                label={`${af.playTime[0]}–${af.playTime[1]}${af.playTime[1] >= 300 ? '+' : ''} min`}
                onDelete={() => updateAndApply({ playTime: [0, 300] })}
                size="small"
                variant="outlined"
              />
            )}
            {(af.complexity[0] > 1 || af.complexity[1] < 5) && (
              <Chip
                label={`Complexity ${af.complexity[0]}–${af.complexity[1]}`}
                onDelete={() => updateAndApply({ complexity: [1, 5] })}
                size="small"
                variant="outlined"
              />
            )}
            {af.minRating > 0 && (
              <Chip
                label={`Rating ${af.minRating}+`}
                onDelete={() => updateAndApply({ minRating: 0 })}
                size="small"
                variant="outlined"
              />
            )}
            {(af.yearRange[0] > 1950 || af.yearRange[1] < 2026) && (
              <Chip
                label={`${af.yearRange[0]}–${af.yearRange[1]}`}
                onDelete={() => updateAndApply({ yearRange: [1950, 2026] })}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        )}

        {/* Results */}
        {loading && <GameLoader variant="cards" message="Loading games..." />}

        {!loading && fuzzyHint && games.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Showing results for <strong>{fuzzyHint}</strong>
          </Typography>
        )}

        {!loading && hasLoaded && games.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              No games match these filters
            </Typography>
            <Button variant="outlined" onClick={clearAllFilters}>
              Clear all filters
            </Button>
          </Box>
        )}

        {!loading && games.map((game, i) => (
          <GameCard key={game.id} game={game} index={i} />
        ))}

        {/* Pagination */}
        {!loading && games.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 2 }}>
            <Button
              variant="outlined"
              disabled={offset === 0}
              onClick={() => fetchGames(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </Typography>
            <Button
              variant="outlined"
              disabled={!hasMore}
              onClick={() => fetchGames(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <FeedbackButton />
        </Box>
      </Stack>
    </Container>
  );
}
