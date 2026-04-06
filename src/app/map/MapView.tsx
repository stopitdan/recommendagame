'use client';

import { useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import GameMap from './GameMap';
import JsonLd from '@/components/JsonLd';

function useWindowHeight() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => window.innerHeight,
    () => 800, // SSR fallback
  );
}

export default function MapView() {
  const searchParams = useSearchParams();
  const initialGameId = searchParams.get('game') ?? undefined;

  const [searchValue, setSearchValue] = useState('');
  const [flyTarget, setFlyTarget] = useState<string | undefined>(initialGameId);
  const windowHeight = useWindowHeight();
  const mapHeight = windowHeight - 64;

  return (
    <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Game Universe Map',
        url: 'https://boredgame.lol/map',
        applicationCategory: 'Entertainment',
        operatingSystem: 'Web',
        description: 'Explore an interactive 3D map of the game universe. Discover relationships between board games, video games, and more.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }} />
      {/* Floating search bar */}
      <Box sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        width: { xs: 'calc(100% - 32px)', sm: 360 },
      }}>
        <SearchAutocomplete
          value={searchValue}
          onChange={setSearchValue}
          onSubmit={() => {}}
          onSelect={(gameId) => {
            setSearchValue('');
            setFlyTarget(gameId);
          }}
          placeholder="Search the game universe..."
        />
      </Box>

      {/* Full-screen game map */}
      <GameMap
        flyTarget={flyTarget}
        height={mapHeight}
      />
    </Box>
  );
}
