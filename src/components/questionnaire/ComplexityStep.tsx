'use client';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import type { ComplexityRange } from '@/types/questionnaire';

const marks = [
  { value: 1, label: 'Chill' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Complex' },
  { value: 5, label: 'Brain Burner' },
];

export interface ComplexityStepProps {
  value: ComplexityRange;
  onChange: (value: ComplexityRange) => void;
}

export default function ComplexityStep({ value, onChange }: ComplexityStepProps) {
  const minLabel = marks.find((m) => m.value === value.min)?.label ?? '';
  const maxLabel = marks.find((m) => m.value === value.max)?.label ?? '';
  const label = value.min === value.max ? minLabel : `${minLabel} to ${maxLabel}`;

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
        max={5}
        step={1}
        marks={marks}
        valueLabelDisplay="off"
      />
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        Drag the handles to set your comfort zone
      </Typography>
    </Box>
  );
}
