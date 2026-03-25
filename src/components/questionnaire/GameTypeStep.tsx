'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import type { GameType } from '@/types/game';

const OPTIONS: { value: GameType | null; label: string; description: string }[] = [
  { value: 'board', label: 'Board Game', description: 'Tabletop, cards, dice' },
  { value: 'video', label: 'Video Game', description: 'PC, console, mobile' },
  { value: 'word', label: 'Word Game', description: 'Wordle, Scrabble, puzzles' },
  { value: 'party', label: 'Party Game', description: 'Groups, laughs, chaos' },
  { value: null, label: 'Surprise Me', description: 'Show me anything good' },
];

export interface GameTypeStepProps {
  value: GameType | null;
  onChange: (value: GameType | null) => void;
}

export default function GameTypeStep({ value, onChange }: GameTypeStepProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
      {OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <Card
            key={option.label}
            variant={isSelected ? 'elevation' : 'outlined'}
            sx={{
              borderColor: isSelected ? '#B9314F' : undefined,
              borderWidth: isSelected ? 2 : 1,
              bgcolor: isSelected ? '#F2E0E4' : undefined,
            }}
          >
            <CardActionArea onClick={() => onChange(option.value)} sx={{ p: 1 }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {option.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
