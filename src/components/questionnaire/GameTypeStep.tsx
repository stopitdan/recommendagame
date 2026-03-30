'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import type { GameType } from '@/types/game';
import { getGameTypeConfig } from '@/lib/game-type-config';

const OPTIONS: { value: GameType | null; label: string; description: string; emoji: string; color: string }[] = [
  { value: 'board', label: 'Board Game', description: 'Tabletop, cards, dice', emoji: '♟️', color: getGameTypeConfig('board').color },
  { value: 'video', label: 'Video Game', description: 'PC, console, mobile', emoji: '🎮', color: getGameTypeConfig('video').color },
  { value: 'word', label: 'Word Game', description: 'Wordle, Scrabble, puzzles', emoji: '🔤', color: getGameTypeConfig('word').color },
  { value: 'party', label: 'Party Game', description: 'Groups, laughs, no equipment', emoji: '🎉', color: getGameTypeConfig('party').color },
  { value: null, label: 'Surprise Me', description: 'Show me anything good', emoji: '🎲', color: '#5B4FDB' },
];

export interface GameTypeStepProps {
  value: GameType[];
  onChange: (value: GameType[]) => void;
}

export default function GameTypeStep({ value, onChange }: GameTypeStepProps) {
  function handleClick(optionValue: GameType | null) {
    // "Surprise Me" clears all selections
    if (optionValue === null) {
      onChange([]);
      return;
    }

    // Toggle the selected type in/out of the array
    if (value.includes(optionValue)) {
      onChange(value.filter((t) => t !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
      {OPTIONS.map((option) => {
        const isSelected = option.value === null
          ? value.length === 0
          : value.includes(option.value);
        return (
          <Card
            key={option.label}
            variant={isSelected ? 'elevation' : 'outlined'}
            sx={{
              borderColor: isSelected ? option.color : undefined,
              borderWidth: isSelected ? 2 : 1,
              bgcolor: isSelected ? `${option.color}0F` : undefined,
              transition: 'all 200ms ease',
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isSelected ? `0 4px 16px ${option.color}33` : undefined,
            }}
          >
            <CardActionArea onClick={() => handleClick(option.value)} sx={{ p: 1 }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography sx={{ fontSize: '2rem', mb: 1, lineHeight: 1 }}>
                  {option.emoji}
                </Typography>
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
