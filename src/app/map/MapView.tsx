'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import GameMap from './GameMap';

export default function MapView() {
  const searchParams = useSearchParams();
  const initialGameId = searchParams.get('game') ?? undefined;

  const [searchValue, setSearchValue] = useState('');
  const [flyTarget, setFlyTarget] = useState<string | undefined>(initialGameId);
  const [mapHeight, setMapHeight] = useState(700);

  // Set height client-side to avoid hydration mismatch
  useEffect(() => {
    setMapHeight(window.innerHeight - 64);
    const handleResize = () => setMapHeight(window.innerHeight - 64);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
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
        initialGameId={flyTarget}
        height={mapHeight}
      />
    </Box>
  );
}
