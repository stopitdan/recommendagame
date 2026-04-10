'use client';

import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'motion/react';
import { Crosshair, Search, Dice5, Palette, Trophy, BookOpen, Wine, Map } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV_ITEMS: { label: string; href: string; Icon: LucideIcon; tip: string }[] = [
  { label: 'Find a Game', href: '/find-a-game', Icon: Crosshair, tip: 'Get personalized recommendations' },
  { label: 'Browse', href: '/browse', Icon: Search, tip: 'Explore the full game catalog' },
  // { label: 'Sommelier', href: '/chat', Icon: Wine, tip: 'Chat with our AI game expert' }, // Hidden until paid tier
  // { label: 'Game Map', href: '/map', Icon: Map, tip: 'Explore the game universe' }, // Hidden until polished
  { label: 'Roll the Dice', href: '/random', Icon: Dice5, tip: 'Roll the d20 for a random pick' },
  // { label: 'Leaderboard', href: '/leaderboard', Icon: Trophy, tip: 'See the most popular games' }, // Hidden — not polished enough yet
  { label: 'Blog', href: '/blog', Icon: BookOpen, tip: 'Game guides and recommendations' },
];

export default function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {NAV_ITEMS.map(({ label, href, Icon, tip }) => {
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
                  gap: 0.75,
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
                <Icon size={16} />
                {label}
              </Button>
            </motion.div>
          </Tooltip>
        );
      })}
    </Box>
  );
}
