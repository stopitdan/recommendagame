'use client';

import { useRouter, usePathname } from 'next/navigation';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

const NAV_ITEMS = [
  { label: 'Browse', href: '/browse' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

export default function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {NAV_ITEMS.map(({ label, href }) => (
        <Button
          key={href}
          variant="text"
          size="small"
          onClick={() => router.push(href)}
          sx={{
            color: pathname === href ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
            fontWeight: pathname === href ? 600 : 400,
            '&:hover': { color: '#FFFFFF' },
          }}
        >
          {label}
        </Button>
      ))}
    </Box>
  );
}
