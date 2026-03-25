'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GENRE_OPTIONS } from '@/types/questionnaire';

const GENRE_EMOJIS: Record<string, string> = {
  Strategy: '♟️',
  RPG: '⚔️',
  Puzzle: '🧩',
  Action: '💥',
  Adventure: '🗺️',
  Horror: '👻',
  'Sci-Fi': '🚀',
  Fantasy: '🧙',
  Trivia: '❓',
  'Word Game': '🔤',
  'Deck Building': '🃏',
  Simulation: '🏗️',
  Sports: '⚽',
  Racing: '🏎️',
  Fighting: '🥊',
  Platformer: '🍄',
  Shooter: '🎯',
  Survival: '🏕️',
  Mystery: '🔍',
  Family: '👨‍👩‍👧‍👦',
};

export interface GenreStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function GenreStep({ value, onChange }: GenreStepProps) {
  function toggle(genre: string) {
    if (value.includes(genre)) {
      onChange(value.filter((g) => g !== genre));
    } else {
      onChange([...value, genre]);
    }
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select all that interest you (or skip for any)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {GENRE_OPTIONS.map((genre) => {
          const isSelected = value.includes(genre);
          const emoji = GENRE_EMOJIS[genre] ?? '🎮';
          return (
            <Chip
              key={genre}
              label={`${emoji} ${genre}`}
              onClick={() => toggle(genre)}
              color={isSelected ? 'secondary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.9rem',
                py: 0.5,
                transition: 'all 200ms ease',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
