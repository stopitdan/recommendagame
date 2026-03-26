'use client';

import { useRouter, usePathname } from 'next/navigation';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'motion/react';

const NAV_ITEMS = [
  { label: 'Find a Game', href: '/find-a-game', icon: '🎯', tip: 'Get personalized recommendations' },
  { label: 'Browse', href: '/browse', icon: '🔍', tip: 'Explore the full game catalog' },
  { label: 'Random', href: '/random', icon: '🎲', tip: 'Roll the d20 for a random pick' },
  { label: 'Leaderboard', href: '/leaderboard', icon: '🏆', tip: 'See the most popular games' },
];

export default function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {NAV_ITEMS.map(({ label, href, icon, tip }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Tooltip key={href} title={tip}>
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
              <Button
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
                <motion.span
                  style={{ fontSize: '0.85rem', display: 'inline-block' }}
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                  transition={{ duration: 0.3 }}
                >
                  {icon}
                </motion.span>
                {label}
              </Button>
            </motion.div>
          </Tooltip>
        );
      })}
    </Box>
  );
}
