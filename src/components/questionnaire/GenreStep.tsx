'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GENRE_OPTIONS } from '@/types/questionnaire';

const GENRE_EMOJIS: Record<string, string> = {
  // Classic
  Strategy: '♟️',
  RPG: '⚔️',
  Puzzle: '🧩',
  Action: '💥',
  Adventure: '🗺️',
  Horror: '👻',
  'Sci-Fi': '🚀',
  Fantasy: '🧙',
  Mystery: '🔍',
  Family: '👨‍👩‍👧‍👦',
  Trivia: '❓',
  'Word Game': '🔤',
  // Modern
  Roguelike: '💀',
  Roguelite: '🔄',
  'Deck Building': '🃏',
  Metroidvania: '🦇',
  Platformer: '🍄',
  'Open World': '🌍',
  Sandbox: '🏖️',
  Shooter: '🎯',
  Fighting: '🥊',
  Racing: '🏎️',
  Sports: '⚽',
  Survival: '🏕️',
  Simulation: '🏗️',
  'City Builder': '🏙️',
  // Board game specific
  'Worker Placement': '👷',
  'Social Deduction': '🕵️',
  Party: '🎉',
  Cooperative: '🤝',
  Campaign: '📜',
  Legacy: '📦',
  // Vibes
  Cozy: '☕',
  Indie: '🎨',
  Retro: '👾',
  Narrative: '📖',
};

export interface GenreStepProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Filtered genre options based on previous questionnaire answers */
  filteredGenres?: readonly string[];
}

export default function GenreStep({ value, onChange, filteredGenres }: GenreStepProps) {
  const genres = filteredGenres ?? GENRE_OPTIONS;
  function toggle(genre: string) {
    if (value.includes(genre)) {
      onChange(value.filter((g) => g !== genre));
    } else {
      onChange([...value, genre]);
    }
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select all that interest you (or skip for any)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {genres.map((genre) => {
          const isSelected = value.includes(genre);
          const emoji = GENRE_EMOJIS[genre] ?? '🎮';
          return (
            <Chip
              key={genre}
              label={`${emoji} ${genre}`}
              onClick={() => toggle(genre)}
              color={isSelected ? 'secondary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.9rem',
                py: 0.5,
                transition: 'all 200ms ease',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
