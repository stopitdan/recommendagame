'use client';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import type { PlayerCountRange } from '@/types/questionnaire';

const marks = [
  { value: 1, label: '1 (Solo)' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 10, label: '10+' },
];

export interface PlayerCountStepProps {
  value: PlayerCountRange;
  onChange: (value: PlayerCountRange) => void;
}

export default function PlayerCountStep({ value, onChange }: PlayerCountStepProps) {
  const label =
    value.min === value.max
      ? `${value.min} player${value.min === 1 ? '' : 's'}`
      : `${value.min}–${value.max} players`;

  return (
    <Box sx={{ px: 2, pt: 2 }}>
      <Typography variant="h5" textAlign="center" sx={{ mb: 4 }}>
        {label}
      </Typography>
      <Slider
        value={[value.min, value.max]}
        onChange={(_, newValue) => {
          const [min, max] = newValue as number[];
          onChange({ min, max });
        }}
        min={1}
        max={10}
        marks={marks}
        valueLabelDisplay="auto"
      />
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        Drag the handles to set a range
      </Typography>
    </Box>
  );
}
