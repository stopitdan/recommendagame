'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Plus, X, Users, Clock, Brain, Star, Calendar, ShoppingCart } from 'lucide-react';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import JsonLd from '@/components/JsonLd';

const MAX_GAMES = 4;

interface CompareRow {
  label: string;
  getValue: (g: Game) => string;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: 'Players',
    getValue: (g) => {
      if (!g.playerCount) return '-';
      const { min, max } = g.playerCount;
      return min === max ? `${min}` : `${min}-${max}`;
    },
  },
  {
    label: 'Play Time',
    getValue: (g) => {
      if (!g.playTime?.average) return g.playTime?.max ? `${g.playTime.min}-${g.playTime.max} min` : '-';
      return `~${g.playTime.average} min`;
    },
  },
  {
    label: 'Complexity',
    getValue: (g) => g.complexity ? `${g.complexity.toFixed(1)} / 5` : '-',
  },
  {
    label: 'Rating',
    getValue: (g) => g.rating ? `${g.rating.toFixed(1)} / 10` : '-',
  },
  {
    label: 'Ratings Count',
    getValue: (g) => g.ratingCount ? g.ratingCount.toLocaleString() : '-',
  },
  {
    label: 'Year',
    getValue: (g) => g.yearPublished ? String(g.yearPublished) : '-',
  },
  {
    label: 'Type',
    getValue: (g) => g.types.map(formatGameType).join(', '),
  },
  {
    label: 'Categories',
    getValue: (g) => g.categories.slice(0, 4).join(', ') || '-',
  },
  {
    label: 'Mechanics',
    getValue: (g) => g.mechanics.slice(0, 4).join(', ') || '-',
  },
];

const ROW_ICONS: Record<string, React.ReactNode> = {
  Players: <Users size={14} />,
  'Play Time': <Clock size={14} />,
  Complexity: <Brain size={14} />,
  Rating: <Star size={14} />,
  Year: <Calendar size={14} />,
};

export default function CompareView() {
  const searchParams = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [searchValue, setSearchValue] = useState('');

  // Load games from URL params on mount
  const loadFromParams = useCallback(async () => {
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
    if (ids.length === 0 || games.length > 0) return;

    const loaded: Game[] = [];
    for (const id of ids.slice(0, MAX_GAMES)) {
      try {
        const res = await fetch(`/api/games/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.game) loaded.push(data.game);
        }
      } catch { /* skip */ }
    }
    if (loaded.length > 0) setGames(loaded);
  }, [searchParams, games.length]);

  // Load on first render if URL has IDs
  useState(() => { loadFromParams(); });

  async function addGame(gameId: string) {
    if (games.length >= MAX_GAMES || games.some((g) => g.id === gameId)) return;
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.game) {
        setGames((prev) => [...prev, data.game]);
        setSearchValue('');
      }
    } catch { /* skip */ }
  }

  function removeGame(gameId: string) {
    setGames((prev) => prev.filter((g) => g.id !== gameId));
  }

  /** Find the best value in a row for highlighting */
  function getBestIndex(row: CompareRow): number | null {
    if (games.length < 2) return null;
    if (row.label === 'Rating' || row.label === 'Ratings Count') {
      let best = -1;
      let bestIdx = -1;
      games.forEach((g, i) => {
        const val = row.label === 'Rating' ? (g.rating ?? 0) : (g.ratingCount ?? 0);
        if (val > best) { best = val; bestIdx = i; }
      });
      return bestIdx >= 0 ? bestIdx : null;
    }
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Game Comparison Tool',
        url: 'https://boredgame.lol/compare',
        applicationCategory: 'Entertainment',
        operatingSystem: 'Web',
        description: 'Compare board games and video games side by side. See ratings, player counts, play time, complexity, and more at a glance.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }} />
      <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
        Compare Games
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Add up to {MAX_GAMES} games to compare side by side.
      </Typography>

      {/* Search to add games */}
      {games.length < MAX_GAMES && (
        <Box sx={{ maxWidth: 400, mb: 4 }}>
          <SearchAutocomplete
            value={searchValue}
            onChange={setSearchValue}
            onSubmit={() => {}}
            onSelect={(gameId) => addGame(gameId)}
            placeholder="Search for a game to add..."
          />
        </Box>
      )}

      {games.length === 0 ? (
        <Card variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Plus size={40} strokeWidth={1} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Search above to add games to compare
          </Typography>
        </Card>
      ) : (
        <>
          {/* Game headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${games.length}, 1fr)`, gap: 1, mb: 1 }}>
            <Box /> {/* empty cell for row labels */}
            {games.map((g) => (
              <Card key={g.id} variant="outlined" sx={{ textAlign: 'center', p: 1.5, position: 'relative' }}>
                <Button
                  size="small"
                  onClick={() => removeGame(g.id)}
                  sx={{ position: 'absolute', top: 4, right: 4, minWidth: 0, p: 0.5, color: 'text.secondary' }}
                >
                  <X size={14} />
                </Button>
                {g.imageUrl && (
                  <Box
                    component="img"
                    src={g.imageUrl}
                    alt={g.name}
                    sx={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 1, mb: 1 }}
                  />
                )}
                <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2, mb: 0.5 }}>
                  {g.name}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  href={`https://www.amazon.com/s?k=${encodeURIComponent(g.name)}&tag=boredgame-20`}
                  target="_blank"
                  rel="noopener noreferrer"
                  component="a"
                  startIcon={<ShoppingCart size={12} />}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', mt: 0.5 }}
                >
                  Buy
                </Button>
              </Card>
            ))}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Comparison rows */}
          <Stack spacing={0}>
            {COMPARE_ROWS.map((row) => {
              const bestIdx = getBestIndex(row);
              return (
                <Box
                  key={row.label}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `140px repeat(${games.length}, 1fr)`,
                    gap: 1,
                    py: 1.5,
                    px: 1,
                    '&:nth-of-type(even)': { bgcolor: 'action.hover' },
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                    {ROW_ICONS[row.label]}
                    <Typography variant="body2" fontWeight={600}>
                      {row.label}
                    </Typography>
                  </Box>
                  {games.map((g, i) => (
                    <Typography
                      key={g.id}
                      variant="body2"
                      sx={{
                        textAlign: 'center',
                        fontWeight: bestIdx === i ? 700 : 400,
                        color: bestIdx === i ? 'primary.main' : 'text.primary',
                      }}
                    >
                      {row.getValue(g)}
                    </Typography>
                  ))}
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Container>
  );
}
