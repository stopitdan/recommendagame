'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GameCard from '@/components/GameCard';
import type { Game } from '@/types/game';

const PAGE_SIZE = 20;

export default function BrowseView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState('rating');
  const [offset, setOffset] = useState(0);

  // Read initial filters from URL
  const category = searchParams.get('category');
  const mechanic = searchParams.get('mechanic');
  const theme = searchParams.get('theme');
  const platform = searchParams.get('platform');
  const type = searchParams.get('type');

  const activeFilter = category || mechanic || theme || platform || type;
  const filterLabel = category ?? mechanic ?? theme ?? platform ?? type ?? 'All Games';
  const filterType = category ? 'category' : mechanic ? 'mechanic' : theme ? 'theme' : platform ? 'platform' : type ? 'type' : null;

  const fetchGames = useCallback(async (newOffset: number = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (mechanic) params.set('mechanic', mechanic);
      if (theme) params.set('theme', theme);
      if (platform) params.set('platform', platform);
      if (type) params.set('type', type);
      if (searchText.trim()) params.set('q', searchText.trim());
      params.set('sort', sort);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(newOffset));

      const res = await fetch(`/api/games/browse?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setGames(data.games ?? []);
      setTotal(data.total ?? 0);
      setOffset(newOffset);
    } finally {
      setLoading(false);
    }
  }, [category, mechanic, theme, platform, type, searchText, sort]);

  useEffect(() => {
    fetchGames(0);
  }, [fetchGames]);

  function clearFilter() {
    router.push('/browse');
  }

  const hasMore = offset + PAGE_SIZE < total;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {activeFilter ? filterLabel : 'Browse Games'}
          </Typography>
          {activeFilter && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Filtering by {filterType}:
              </Typography>
              <Chip
                label={filterLabel}
                onDelete={clearFilter}
                color="secondary"
                size="small"
              />
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {total.toLocaleString()} games found
          </Typography>
        </Box>

        {/* Search + Sort controls */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search within results..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchGames(0)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sort}
              label="Sort by"
              onChange={(e) => setSort(e.target.value)}
            >
              <MenuItem value="rating">Rating</MenuItem>
              <MenuItem value="popularity">Most Popular</MenuItem>
              <MenuItem value="name">Name (A-Z)</MenuItem>
              <MenuItem value="year">Newest First</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Results */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: 'secondary.main' }} />
          </Box>
        )}

        {!loading && games.length === 0 && (
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 8 }}>
            No games found matching these filters.
          </Typography>
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
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
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
