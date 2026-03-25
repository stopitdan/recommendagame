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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Optional — describe what you&apos;re looking for in your own words
      </Typography>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={4}
        fullWidth
        placeholder='e.g. "Something like Catan but faster" or "A cozy game for date night"'
        variant="outlined"
      />
    </Box>
  );
}
