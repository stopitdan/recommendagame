'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Puzzle, Gamepad2 } from 'lucide-react';
import GameCard from './GameCard';
import type { Game, GameType } from '@/types/game';

interface CrossTypeRecommendationsProps {
  gameId: string;
  /** The current game's primary type */
  gameType: GameType;
  gameName: string;
  /** The game's categories to match against */
  categories: string[];
  mechanics: string[];
}

/**
 * Shows recommendations from the opposite game type.
 * Video game pages get "Board games you might like".
 * Board game pages get "Video games you might like".
 * Only renders for board/video games (not word/party).
 */
export default function CrossTypeRecommendations({ gameId, gameType, gameName, categories, mechanics }: CrossTypeRecommendationsProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Only show cross-type for board <-> video
  const targetType = gameType === 'video' ? 'board' : gameType === 'board' ? 'video' : null;

  useEffect(() => {
    if (!targetType) { setLoading(false); return; }

    async function fetchCrossType() {
      setLoading(true);
      try {
        // Find games of the opposite type that share a category or mechanic.
        // Use the browse API with the first matching category.
        const searchTag = categories[0] ?? mechanics[0];
        if (!searchTag) return;

        const params = new URLSearchParams({
          type: targetType!,
          category: searchTag,
          sort: 'popularity',
          limit: '4',
        });
        const res = await fetch(`/api/games/browse?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setGames((data.games ?? []).filter((g: Game) => g.id !== gameId));
      } catch {
        // Silently fail -- this is a bonus section
      } finally {
        setLoading(false);
      }
    }
    fetchCrossType();
  }, [gameId, targetType]);

  if (!targetType || loading || games.length === 0) return null;

  const icon = targetType === 'board'
    ? <Puzzle size={20} />
    : <Gamepad2 size={20} />;

  const title = targetType === 'board'
    ? 'Board games you might like'
    : 'Video games you might like';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Based on what you enjoy about {gameName}
      </Typography>
      <Stack spacing={2}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </Stack>
    </Box>
  );
}
