'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GENRE_OPTIONS } from '@/types/questionnaire';

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
          return (
            <Chip
              key={genre}
              label={genre}
              onClick={() => toggle(genre)}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
            />
          );
        })}
      </Box>
    </Box>
  );
}
