'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Map } from 'lucide-react';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import GameNeighborhood from '@/components/GameNeighborhood';

export default function MapView() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('game');
  const initialName = searchParams.get('name') ?? '';

  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialId);
  const [selectedName, setSelectedName] = useState(initialName);
  const [searchValue, setSearchValue] = useState('');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Map size={24} />
        <Typography variant="h4" fontWeight={800}>
          Game Map
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search for a game, then click nodes to explore similar titles.
      </Typography>

      <Box sx={{ maxWidth: 500, mb: 3 }}>
        <SearchAutocomplete
          value={searchValue}
          onChange={setSearchValue}
          onSubmit={() => {}}
          onSelect={(gameId, gameName) => {
            setSelectedGameId(gameId);
            setSelectedName(gameName);
            setSearchValue('');
          }}
          placeholder="Search for a game..."
        />
      </Box>

      {selectedGameId ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Exploring: {selectedName}
          </Typography>
          <GameNeighborhood
            gameId={selectedGameId}
            height={550}
            onRecenter={(id, name) => {
              setSelectedGameId(id);
              setSelectedName(name);
            }}
          />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Map size={48} />
          <Typography variant="h6" sx={{ mt: 2, fontWeight: 600 }}>
            Search for a game above to start exploring
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Each node is a game, sized by popularity and colored by type.
            Click any node to re-center and explore its neighborhood.
          </Typography>
        </Box>
      )}
    </Container>
  );
}
