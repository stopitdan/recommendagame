'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { MOOD_OPTIONS } from '@/types/questionnaire';

export interface MoodStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function MoodStep({ value, onChange }: MoodStepProps) {
  function toggle(moodId: string) {
    if (value.includes(moodId)) {
      onChange(value.filter((m) => m !== moodId));
    } else {
      onChange([...value, moodId]);
    }
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
      {MOOD_OPTIONS.map((mood) => {
        const isSelected = value.includes(mood.id);
        return (
          <Card
            key={mood.id}
            variant={isSelected ? 'elevation' : 'outlined'}
            sx={{
              borderColor: isSelected ? 'primary.main' : undefined,
              borderWidth: isSelected ? 2 : 1,
              bgcolor: isSelected ? 'primary.50' : undefined,
            }}
          >
            <CardActionArea onClick={() => toggle(mood.id)} sx={{ p: 1 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {mood.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mood.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
