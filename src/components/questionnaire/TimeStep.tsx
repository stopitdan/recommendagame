'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { TimePreset } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';

export interface TimeStepProps {
  value: TimePreset | null;
  onChange: (value: TimePreset | null) => void;
}

const presetKeys = Object.keys(TIME_PRESETS) as TimePreset[];

export default function TimeStep({ value, onChange }: TimeStepProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center', pt: 2 }}>
      {presetKeys.map((key) => {
        const preset = TIME_PRESETS[key];
        const isSelected = value === key;
        return (
          <Chip
            key={key}
            label={`${preset.label} (${preset.description})`}
            onClick={() => onChange(isSelected ? null : key)}
            color={isSelected ? 'primary' : 'default'}
            variant={isSelected ? 'filled' : 'outlined'}
            sx={{ py: 2.5, px: 1, fontSize: '0.95rem' }}
          />
        );
      })}
    </Box>
  );
}
