'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  Package, PackageCheck, Plus, Search, Trash2, Library,
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import { createClient } from '@/lib/supabase/client';
import type { Game } from '@/types/game';

interface OwnedGame {
  game_id: string;
  source: string;
  added_at: string;
  game?: Game;
}

export default function CollectionView() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [ownedGames, setOwnedGames] = useState<OwnedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0); // 0 = My Collection, 1 = Add Games
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const ownedIdSet = new Set(ownedGames.map((og) => og.game_id));

  // Check auth and load collection
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }
      setIsLoggedIn(true);
      try {
        const res = await fetch('/api/owned');
        if (res.ok) {
          const data = await res.json();
          setOwnedGames(data.owned ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Search for games to add
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // Add a game to collection
  async function addGame(game: Game) {
    if (ownedIdSet.has(game.id) || addingIds.has(game.id)) return;
    setAddingIds((prev) => new Set(prev).add(game.id));
    try {
      const res = await fetch('/api/owned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id }),
      });
      if (res.ok) {
        setOwnedGames((prev) => [
          { game_id: game.id, source: 'manual', added_at: new Date().toISOString(), game },
          ...prev,
        ]);
        showSuccess(`Added ${game.name} to your collection`);
      }
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(game.id);
        return next;
      });
    }
  }

  // Remove a game from collection
  async function removeGame(gameId: string, gameName: string) {
    setRemovingIds((prev) => new Set(prev).add(gameId));
    try {
      const res = await fetch('/api/owned', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        setOwnedGames((prev) => prev.filter((og) => og.game_id !== gameId));
        showSuccess(`Removed ${gameName} from your collection`);
      }
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }
  }

  function showSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  // Handle selecting a game from autocomplete in the "Add Games" tab
  function handleAutocompleteSelect(gameId: string) {
    // Find from search results or fetch and add
    const game = searchResults.find((g) => g.id === gameId);
    if (game) {
      addGame(game);
    } else {
      // Fetch the game data then add
      fetch(`/api/games/${encodeURIComponent(gameId)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.game) addGame(data.game); });
    }
  }

  // Filter owned games
  const filteredOwned = ownedGames.filter((og) => {
    if (filterSource && og.source !== filterSource) return false;
    if (filterText.trim() && og.game) {
      return og.game.name.toLowerCase().includes(filterText.toLowerCase());
    }
    return true;
  });

  // Auth gate
  if (isLoggedIn === false) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Package size={48} />
        <Typography variant="h5" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
          Build Your Collection
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Log in to start building your game collection. Once you have games in your collection, you can search exclusively from what you own.
        </Typography>
        <Button variant="contained" size="large" onClick={() => router.push('/login')}>
          Log In to Get Started
        </Button>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              My Collection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {ownedGames.length} {ownedGames.length === 1 ? 'game' : 'games'} in your collection
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => router.push('/profile?tab=collection')}
            >
              Import from BGG / Steam
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                setTab(1);
                // Focus the search after tab switch
                setTimeout(() => document.querySelector<HTMLInputElement>('[data-collection-search] input')?.focus(), 100);
              }}
              startIcon={<Plus size={16} />}
            >
              Add Games
            </Button>
          </Box>
        </Box>

        {/* Success toast */}
        {successMessage && (
          <Alert severity="success" onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': {
              background: 'linear-gradient(90deg, #5B4FDB, #FF6D3F)',
              height: 3,
              borderRadius: 2,
            },
          }}
        >
          <Tab label={`My Games (${ownedGames.length})`} icon={<Library size={16} />} iconPosition="start" />
          <Tab label="Add Games" icon={<Plus size={16} />} iconPosition="start" />
        </Tabs>

        {/* Tab: My Games */}
        {tab === 0 && (
          <Stack spacing={2}>
            {ownedGames.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Package size={48} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  No games in your collection yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Start building your collection by searching for games you own, or import from BoardGameGeek or Steam.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={() => setTab(1)}
                    startIcon={<Search size={16} />}
                  >
                    Search and Add Games
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => router.push('/profile?tab=collection')}
                  >
                    Import from BGG / Steam
                  </Button>
                </Box>
              </Box>
            ) : (
              <>
                {/* Filters for the collection */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Filter your collection..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    sx={{ flex: 1, minWidth: 200 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[
                      { label: 'All', value: null },
                      { label: 'Manual', value: 'manual' },
                      { label: 'BGG', value: 'bgg' },
                      { label: 'Steam', value: 'steam' },
                    ].map((opt) => (
                      <Chip
                        key={opt.label}
                        label={opt.label}
                        onClick={() => setFilterSource(opt.value)}
                        variant={filterSource === opt.value ? 'filled' : 'outlined'}
                        color={filterSource === opt.value ? 'primary' : 'default'}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>

                {/* Tip about collection-only search */}
                <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
                  Use <strong>&ldquo;My Collection&rdquo;</strong> when searching for recommendations to only get picks from games you own.
                  <Button
                    size="small"
                    sx={{ ml: 1, textTransform: 'none' }}
                    onClick={() => router.push('/find-a-game')}
                  >
                    Try it now
                  </Button>
                </Alert>

                <Typography variant="body2" color="text.secondary">
                  {filteredOwned.length === ownedGames.length
                    ? `${ownedGames.length} games`
                    : `Showing ${filteredOwned.length} of ${ownedGames.length} games`
                  }
                </Typography>

                {filteredOwned.map((og) =>
                  og.game ? (
                    <Box key={og.game_id} sx={{ position: 'relative' }}>
                      <GameCard game={og.game} showFavorite />
                      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Chip
                          label={og.source === 'bgg' ? 'BGG' : og.source === 'steam' ? 'Steam' : 'Manual'}
                          size="small"
                          variant="outlined"
                          color={og.source === 'bgg' ? 'primary' : og.source === 'steam' ? 'secondary' : 'default'}
                        />
                        <Tooltip title="Remove from collection">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGame(og.game_id, og.game?.name ?? 'Game');
                            }}
                            disabled={removingIds.has(og.game_id)}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ) : null
                )}
              </>
            )}
          </Stack>
        )}

        {/* Tab: Add Games */}
        {tab === 1 && (
          <Stack spacing={3}>
            {/* Search bar */}
            <Card
              variant="outlined"
              sx={{
                p: 3,
                borderColor: 'primary.main',
                borderWidth: 2,
                background: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(91, 79, 219, 0.05)'
                    : 'rgba(91, 79, 219, 0.02)',
              }}
            >
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Search for games to add
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Find games by name and add them to your collection. We have over 178,000 board and video games indexed.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }} data-collection-search>
                <SearchAutocomplete
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearch}
                  onSelect={handleAutocompleteSelect}
                  placeholder="Type a game name..."
                />
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                >
                  {searchLoading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
                </Button>
              </Box>
            </Card>

            {/* Search results */}
            {searchLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {!searchLoading && hasSearched && searchResults.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No games found for &ldquo;{searchQuery}&rdquo;. Try a different search.
                </Typography>
              </Box>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {searchResults.length} results found
                </Typography>
                {searchResults.map((game) => {
                  const isOwned = ownedIdSet.has(game.id);
                  const isAdding = addingIds.has(game.id);
                  return (
                    <Box key={game.id} sx={{ position: 'relative' }}>
                      <GameCard game={game} showFavorite />
                      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                        {isOwned ? (
                          <Chip
                            icon={<PackageCheck size={14} />}
                            label="In Collection"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 600 }}
                          />
                        ) : (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              addGame(game);
                            }}
                            disabled={isAdding}
                            startIcon={isAdding ? <CircularProgress size={14} color="inherit" /> : <Plus size={14} />}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 600,
                              bgcolor: 'secondary.main',
                              '&:hover': { bgcolor: '#E85A2E' },
                            }}
                          >
                            {isAdding ? 'Adding...' : 'Add to Collection'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}

            {/* Help text when no search yet */}
            {!hasSearched && !searchLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Search size={40} />
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  Search for any game to add it to your collection
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You can also add games by clicking the <Package size={14} style={{ verticalAlign: 'middle' }} /> icon on any game page throughout the site.
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
