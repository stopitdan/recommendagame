'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Skeleton placeholder for GameCard while loading.
 * Matches the GameCard layout for smooth transition.
 */
export default function GameCardSkeleton() {
  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
      <Skeleton
        variant="rectangular"
        sx={{
          width: { xs: '100%', sm: 140 },
          height: { xs: 160, sm: 120 },
          flexShrink: 0,
        }}
      />
      <CardContent sx={{ flex: 1, py: 2 }}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="rounded" width={40} height={24} />
          </Box>
          <Skeleton variant="text" width="40%" height={20} />
          <Skeleton variant="text" width="90%" height={20} />
          <Skeleton variant="text" width="70%" height={20} />
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Skeleton variant="rounded" width={60} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={70} height={24} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Multiple skeleton cards for list loading states.
 */
export function GameCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <Stack spacing={2}>
      {Array.from({ length: count }, (_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </Stack>
  );
}
