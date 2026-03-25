'use client';

import { useRouter, usePathname } from 'next/navigation';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

const NAV_ITEMS = [
  { label: 'Find a Game', href: '/questionnaire', icon: '🎯' },
  { label: 'Browse', href: '/browse', icon: '🔍' },
  { label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
];

export default function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {NAV_ITEMS.map(({ label, href, icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Button
            key={href}
            variant="text"
            size="small"
            onClick={() => router.push(href)}
            sx={{
              color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              fontWeight: isActive ? 600 : 400,
              position: 'relative',
              px: 1.5,
              gap: 0.5,
              '&:hover': {
                color: '#FFFFFF',
                backgroundColor: 'rgba(255,255,255,0.08)',
              },
              // Active underline indicator
              '&::after': isActive ? {
                content: '""',
                position: 'absolute',
                bottom: 2,
                left: '20%',
                right: '20%',
                height: 2,
                borderRadius: 1,
                background: 'linear-gradient(90deg, #FF6D3F, #0EC6C6)',
              } : {},
              transition: 'all 200ms ease',
            }}
          >
            <Box component="span" sx={{ fontSize: '0.85rem', display: { xs: 'none', md: 'inline' } }}>
              {icon}
            </Box>
            {label}
          </Button>
        );
      })}
    </Box>
  );
}
