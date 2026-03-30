'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Map } from 'lucide-react';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import GameNeighborhood from '@/components/GameNeighborhood';

export default function MapView() {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Map size={24} />
        <Typography variant="h4" fontWeight={800}>
          Game Map
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Pick any game to explore its neighborhood of similar titles.
      </Typography>

      <Box sx={{ maxWidth: 500, mb: 3 }}>
        <SearchAutocomplete
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          onSelect={(gameId, gameName) => {
            setSelectedGameId(gameId);
            setSelectedName(gameName);
          }}
          placeholder="Search for a game to start exploring..."
        />
      </Box>

      {selectedGameId ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Neighborhood of {selectedName}
          </Typography>
          <GameNeighborhood key={selectedGameId} gameId={selectedGameId} height={550} />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Map size={48} />
          <Typography variant="h6" sx={{ mt: 2, fontWeight: 600 }}>
            Search for a game above to see its neighborhood
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Each node is a game, sized by popularity and colored by type.
            Lines connect similar games.
          </Typography>
        </Box>
      )}
    </Container>
  );
}
