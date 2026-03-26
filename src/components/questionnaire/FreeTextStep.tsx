'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export interface FreeTextStepProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FreeTextStep({ value, onChange }: FreeTextStepProps) {
  return (
    <Box>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={4}
        fullWidth
        placeholder='e.g. "A roguelike deck builder for 2 players", "Something like Catan but faster", "A cozy game for date night with my partner"'
        variant="outlined"
        sx={{ mt: 1 }}
      />
    </Box>
  );
}
