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
import GameCard from '@/components/GameCard';
import { GameCardSkeletonList } from '@/components/GameCardSkeleton';
import type { Game } from '@/types/game';

const PAGE_SIZE = 20;

// ─── Filter State ────────────────────────────────────────────

interface Filters {
  type: string | null;
  category: string | null;
  mechanic: string | null;
  theme: string | null;
  platform: string | null;
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
  category: null,
  mechanic: null,
  theme: null,
  platform: null,
  q: '',
  sort: 'rating',
  popularity: 'popular',
  playerCount: [1, 10],
  playTime: [0, 300],
  complexity: [1, 5],
  minRating: 0,
  yearRange: [1950, 2026],
};

// Common categories from BGG + RAWG
const CATEGORY_OPTIONS = [
  'Abstract Strategy', 'Action', 'Adventure', 'Animals', 'Bluffing',
  'Card Game', 'City Building', 'Civilization', 'Collectible Components',
  'Comic Book / Strip', 'Deduction', 'Dice', 'Economic', 'Educational',
  'Electronic', 'Environmental', 'Exploration', 'Family Game', 'Fantasy',
  'Fighting', 'Horror', 'Humor', 'Industry / Manufacturing', 'Indie',
  'Maze', 'Medieval', 'Miniatures', 'Movies / TV', 'Murder/Mystery',
  'Mythology', 'Nautical', 'Negotiation', 'Party Game', 'Pirates',
  'Political', 'Prehistoric', 'Print & Play', 'Puzzle', 'RPG',
  'Racing', 'Real-time', 'Religious', 'Renaissance', 'Science Fiction',
  'Shooter', 'Simulation', 'Space Exploration', 'Spies/Secret Agents',
  'Sports', 'Strategy', 'Survival', 'Territory Building', 'Trains',
  'Transportation', 'Travel', 'Trivia', 'War', 'Word Game', 'Zombies',
].sort();

// Common mechanics from BGG
const MECHANIC_OPTIONS = [
  'Action Points', 'Area Control', 'Area Movement', 'Auction/Bidding',
  'Betting and Bluffing', 'Campaign / Battle Card Driven', 'Card Drafting',
  'Chit-Pull System', 'Cooperative Game', 'Deck Building',
  'Dice Rolling', 'Drafting', 'Engine Building', 'Grid Movement',
  'Hand Management', 'Hidden Movement', 'Hidden Roles',
  'Hexagon Grid', 'Income', 'Legacy Game', 'Line of Sight',
  'Market', 'Memory', 'Modular Board', 'Move Through Deck',
  'Network and Route Building', 'Once-Per-Game Abilities',
  'Pattern Building', 'Pick-up and Deliver', 'Player Elimination',
  'Point to Point Movement', 'Press Your Luck', 'Programmed Movement',
  'Push Your Luck', 'Real-Time', 'Resource Management',
  'Rock-Paper-Scissors', 'Role Playing', 'Roll / Spin and Move',
  'Rondel', 'Route Building', 'Semi-Cooperative Game',
  'Set Collection', 'Simultaneous Action Selection',
  'Social Deduction', 'Solo / Solitaire Game', 'Storytelling',
  'Take That', 'Tile Placement', 'Time Track', 'Trading',
  'Trick-taking', 'Variable Phase Order', 'Variable Player Powers',
  'Voting', 'Worker Placement',
].sort();

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
  const [offset, setOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    type: searchParams.get('type'),
    category: searchParams.get('category'),
    mechanic: searchParams.get('mechanic'),
    theme: searchParams.get('theme'),
    platform: searchParams.get('platform'),
    q: searchParams.get('q') ?? '',
  }));

  function updateFilter(partial: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  const fetchGames = useCallback(async (newOffset: number = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.mechanic) params.set('mechanic', filters.mechanic);
      if (filters.theme) params.set('theme', filters.theme);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.type) params.set('type', filters.type);
      if (filters.q.trim()) params.set('q', filters.q.trim());
      params.set('sort', filters.sort);
      params.set('popularity', filters.popularity);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(newOffset));

      // Numeric range filters — only send if different from defaults
      if (filters.playerCount[0] > 1) params.set('minPlayers', String(filters.playerCount[0]));
      if (filters.playerCount[1] < 10) params.set('maxPlayers', String(filters.playerCount[1]));
      if (filters.playTime[0] > 0) params.set('minTime', String(filters.playTime[0]));
      if (filters.playTime[1] < 300) params.set('maxTime', String(filters.playTime[1]));
      if (filters.complexity[0] > 1) params.set('minComplexity', String(filters.complexity[0]));
      if (filters.complexity[1] < 5) params.set('maxComplexity', String(filters.complexity[1]));
      if (filters.minRating > 0) params.set('minRating', String(filters.minRating));
      if (filters.yearRange[0] > 1950) params.set('yearFrom', String(filters.yearRange[0]));
      if (filters.yearRange[1] < 2026) params.set('yearTo', String(filters.yearRange[1]));

      const res = await fetch(`/api/games/browse?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setGames(data.games ?? []);
      setTotal(data.total ?? 0);
      setOffset(newOffset);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGames(0);
  }, [fetchGames]);

  function clearAllFilters() {
    setFilters(DEFAULT_FILTERS);
    router.push('/browse');
  }

  const hasActiveFilters = filters.type || filters.category || filters.mechanic ||
    filters.theme || filters.platform || filters.q.trim() ||
    filters.playerCount[0] > 1 || filters.playerCount[1] < 10 ||
    filters.playTime[0] > 0 || filters.playTime[1] < 300 ||
    filters.complexity[0] > 1 || filters.complexity[1] < 5 ||
    filters.minRating > 0 ||
    filters.yearRange[0] > 1950 || filters.yearRange[1] < 2026;

  const activeFilterCount = [
    filters.type, filters.category, filters.mechanic, filters.theme, filters.platform,
    filters.q.trim() || null,
    filters.playerCount[0] > 1 || filters.playerCount[1] < 10 ? 'players' : null,
    filters.playTime[0] > 0 || filters.playTime[1] < 300 ? 'time' : null,
    filters.complexity[0] > 1 || filters.complexity[1] < 5 ? 'complexity' : null,
    filters.minRating > 0 ? 'rating' : null,
    filters.yearRange[0] > 1950 || filters.yearRange[1] < 2026 ? 'year' : null,
  ].filter(Boolean).length;

  const hasMore = offset + PAGE_SIZE < total;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
          {[
            { label: 'All', value: null, emoji: '🎲' },
            { label: 'Board Games', value: 'board', emoji: '♟️' },
            { label: 'Video Games', value: 'video', emoji: '🎮' },
            { label: 'Word Games', value: 'word', emoji: '🔤' },
            { label: 'Party Games', value: 'party', emoji: '🎉' },
          ].map((t) => (
            <Chip
              key={t.label}
              label={`${t.emoji} ${t.label}`}
              onClick={() => updateFilter({ type: t.value })}
              color={filters.type === t.value || (!filters.type && !t.value) ? 'primary' : 'default'}
              variant={filters.type === t.value || (!filters.type && !t.value) ? 'filled' : 'outlined'}
              sx={{ transition: 'all 200ms ease' }}
            />
          ))}
        </Box>

        {/* Search + Sort + Filter toggle */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search games..."
            value={filters.q}
            onChange={(e) => updateFilter({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && fetchGames(0)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={filters.sort}
              label="Sort by"
              onChange={(e) => updateFilter({ sort: e.target.value })}
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
            onClick={() => setFiltersOpen(!filtersOpen)}
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

              {/* Row 4: Category + Mechanic autocomplete */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Autocomplete
                  value={filters.category}
                  onChange={(_, v) => updateFilter({ category: v })}
                  options={CATEGORY_OPTIONS}
                  renderInput={(params) => (
                    <TextField {...params} label="Category" size="small" placeholder="Type to search..." />
                  )}
                  freeSolo={false}
                  clearOnBlur
                  size="small"
                />
                <Autocomplete
                  value={filters.mechanic}
                  onChange={(_, v) => updateFilter({ mechanic: v })}
                  options={MECHANIC_OPTIONS}
                  renderInput={(params) => (
                    <TextField {...params} label="Mechanic" size="small" placeholder="Type to search..." />
                  )}
                  freeSolo={false}
                  clearOnBlur
                  size="small"
                />
              </Box>

              {/* Row 5: Popularity mode */}
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
                <Button variant="contained" onClick={() => fetchGames(0)}>
                  Apply Filters
                </Button>
              </Box>
            </Stack>
          </Box>
        </Collapse>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {filters.category && (
              <Chip label={`Category: ${filters.category}`} onDelete={() => updateFilter({ category: null })} size="small" color="secondary" />
            )}
            {filters.mechanic && (
              <Chip label={`Mechanic: ${filters.mechanic}`} onDelete={() => updateFilter({ mechanic: null })} size="small" color="secondary" />
            )}
            {filters.theme && (
              <Chip label={`Theme: ${filters.theme}`} onDelete={() => updateFilter({ theme: null })} size="small" color="secondary" />
            )}
            {(filters.playerCount[0] > 1 || filters.playerCount[1] < 10) && (
              <Chip
                label={`${filters.playerCount[0]}–${filters.playerCount[1]}${filters.playerCount[1] >= 10 ? '+' : ''} players`}
                onDelete={() => updateFilter({ playerCount: [1, 10] })}
                size="small"
                variant="outlined"
              />
            )}
            {(filters.playTime[0] > 0 || filters.playTime[1] < 300) && (
              <Chip
                label={`${filters.playTime[0]}–${filters.playTime[1]}${filters.playTime[1] >= 300 ? '+' : ''} min`}
                onDelete={() => updateFilter({ playTime: [0, 300] })}
                size="small"
                variant="outlined"
              />
            )}
            {(filters.complexity[0] > 1 || filters.complexity[1] < 5) && (
              <Chip
                label={`Complexity ${filters.complexity[0]}–${filters.complexity[1]}`}
                onDelete={() => updateFilter({ complexity: [1, 5] })}
                size="small"
                variant="outlined"
              />
            )}
            {filters.minRating > 0 && (
              <Chip
                label={`Rating ${filters.minRating}+`}
                onDelete={() => updateFilter({ minRating: 0 })}
                size="small"
                variant="outlined"
              />
            )}
            {(filters.yearRange[0] > 1950 || filters.yearRange[1] < 2026) && (
              <Chip
                label={`${filters.yearRange[0]}–${filters.yearRange[1]}`}
                onDelete={() => updateFilter({ yearRange: [1950, 2026] })}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        )}

        {/* Results */}
        {loading && <GameCardSkeletonList count={5} />}

        {!loading && games.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              No games match these filters
            </Typography>
            <Button variant="outlined" onClick={clearAllFilters}>
              Clear all filters
            </Button>
          </Box>
        )}

        {!loading && games.map((game) => (
          <GameCard key={game.id} game={game} />
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
      </Stack>
    </Container>
  );
}
