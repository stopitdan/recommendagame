'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { TimePreset } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';

export interface TimeStepProps {
  value: TimePreset[];
  onChange: (value: TimePreset[]) => void;
}

const presetKeys = Object.keys(TIME_PRESETS) as TimePreset[];

export default function TimeStep({ value, onChange }: TimeStepProps) {
  function handleClick(key: TimePreset) {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center', pt: 2 }}>
      {presetKeys.map((key) => {
        const preset = TIME_PRESETS[key];
        const isSelected = value.includes(key);
        return (
          <Chip
            key={key}
            label={`${preset.label} (${preset.description})`}
            onClick={() => handleClick(key)}
            color={isSelected ? 'secondary' : 'default'}
            variant={isSelected ? 'filled' : 'outlined'}
            sx={{ py: 2.5, px: 1, fontSize: '0.95rem' }}
          />
        );
      })}
    </Box>
  );
}
