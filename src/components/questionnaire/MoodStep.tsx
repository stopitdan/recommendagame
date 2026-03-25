'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { MOOD_OPTIONS } from '@/types/questionnaire';

const MOOD_EMOJIS: Record<string, string> = {
  competitive: '⚔️',
  cooperative: '🤝',
  chill: '😌',
  'brain-teaser': '🧠',
  social: '💬',
  'story-driven': '📖',
};

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
              borderColor: isSelected ? 'secondary.main' : undefined,
              borderWidth: isSelected ? 2 : 1,
              bgcolor: isSelected ? 'secondary.light' : undefined,
              transition: 'all 200ms ease',
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isSelected ? '0 4px 16px rgba(255, 109, 63, 0.2)' : undefined,
            }}
          >
            <CardActionArea onClick={() => toggle(mood.id)} sx={{ p: 1 }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography sx={{ fontSize: '1.6rem', mb: 0.5, lineHeight: 1 }}>
                  {MOOD_EMOJIS[mood.id] ?? '🎯'}
                </Typography>
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
