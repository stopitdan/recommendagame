'use client';

import { useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import {
  Crosshair, Search, Dice5, Palette, Trophy, BookOpen, Wine, Map,
  User, Heart, ClipboardList, Settings, Package, Shield,
  LogIn, Sparkles, LogOut, Sun, Moon,
} from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { useColorMode } from './ThemeRegistry';

interface MobileNavProps {
  isLoggedIn: boolean;
  email: string;
  displayName?: string;
}

const NAV_ITEMS: { label: string; href: string; icon: ReactNode }[] = [
  { label: 'Find a Game', href: '/find-a-game', icon: <Crosshair size={18} /> },
  { label: 'Browse', href: '/browse', icon: <Search size={18} /> },
  // { label: 'Game Map', href: '/map', icon: <Map size={18} /> }, // Hidden until polished
  // { label: 'Sommelier', href: '/chat', icon: <Wine size={18} /> }, // Hidden until paid tier
  { label: 'Roll the Dice', href: '/random', icon: <Dice5 size={18} /> },
  { label: 'Leaderboard', href: '/leaderboard', icon: <Trophy size={18} /> },
  { label: 'Blog', href: '/blog', icon: <BookOpen size={18} /> },
];

const USER_ITEMS: { label: string; href: string; icon: ReactNode }[] = [
  { label: 'My Profile', href: '/profile', icon: <User size={18} /> },
  { label: 'My Collection', href: '/collection', icon: <Package size={18} /> },
  { label: 'Favorites', href: '/favorites', icon: <Heart size={18} /> },
  { label: 'Saved Presets', href: '/presets', icon: <ClipboardList size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
];

const ADMIN_EMAIL = 'danjwiegand@gmail.com';

export default function MobileNav({ isLoggedIn, email, displayName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        sx={{ color: 'white', ml: 1 }}
        aria-label="Open navigation menu"
      >
        <Box sx={{ width: 24, height: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px' }}>
          <Box sx={{ width: 24, height: 2, bgcolor: 'white', borderRadius: 1, transition: 'all 200ms' }} />
          <Box sx={{ width: 18, height: 2, bgcolor: 'white', borderRadius: 1, transition: 'all 200ms' }} />
          <Box sx={{ width: 24, height: 2, bgcolor: 'white', borderRadius: 1, transition: 'all 200ms' }} />
        </Box>
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: 'linear-gradient(180deg, #1A1A2E 0%, #2D2B55 100%)',
            color: 'white',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Dice5 size={20} /> boredgame.lol
          </Typography>
          {isLoggedIn && (
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
              {displayName || email}
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Main nav */}
        <List sx={{ px: 1, py: 1 }}>
          {NAV_ITEMS.map(({ label, href, icon }) => (
            <ListItemButton
              key={href}
              onClick={() => navigate(href)}
              selected={pathname === href}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(91, 79, 219, 0.2)',
                  '&:hover': { bgcolor: 'rgba(91, 79, 219, 0.3)' },
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{icon}</ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontWeight: pathname === href ? 600 : 400, color: 'white' }}
              />
            </ListItemButton>
          ))}
        </List>

        {isLoggedIn && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <List sx={{ px: 1, py: 1 }}>
              {USER_ITEMS.map(({ label, href, icon }) => (
                <ListItemButton
                  key={href}
                  onClick={() => navigate(href)}
                  selected={pathname === href}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    '&.Mui-selected': { bgcolor: 'rgba(255, 109, 63, 0.2)' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{icon}</ListItemIcon>
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ fontWeight: pathname === href ? 600 : 400, color: 'white' }}
                  />
                </ListItemButton>
              ))}
            </List>

            {email === ADMIN_EMAIL && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <List sx={{ px: 1, py: 1 }}>
                  <ListItemButton
                    onClick={() => navigate('/admin')}
                    selected={pathname.startsWith('/admin')}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Shield size={18} /></ListItemIcon>
                    <ListItemText primary="Admin" primaryTypographyProps={{ fontWeight: pathname.startsWith('/admin') ? 600 : 400, color: 'white' }} />
                  </ListItemButton>
                </List>
              </>
            )}
          </>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        <List sx={{ px: 1, py: 1 }}>
          <MobileDarkModeToggle />
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        <List sx={{ px: 1, py: 1 }}>
          {!isLoggedIn ? (
            <>
              <ListItemButton onClick={() => navigate('/login')} sx={{ borderRadius: 2, mb: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><LogIn size={18} /></ListItemIcon>
                <ListItemText primary="Log In" primaryTypographyProps={{ color: 'white' }} />
              </ListItemButton>
              <ListItemButton
                onClick={() => navigate('/signup')}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(255, 109, 63, 0.3), rgba(255, 109, 63, 0.1))',
                  '&:hover': { background: 'linear-gradient(135deg, rgba(255, 109, 63, 0.4), rgba(255, 109, 63, 0.2))' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Sparkles size={18} /></ListItemIcon>
                <ListItemText primary="Sign Up" primaryTypographyProps={{ fontWeight: 600, color: 'white' }} />
              </ListItemButton>
            </>
          ) : (
            <ListItemButton
              onClick={() => { setOpen(false); logout(); }}
              sx={{ borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><LogOut size={18} /></ListItemIcon>
              <ListItemText primary="Log Out" primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)' }} />
            </ListItemButton>
          )}
        </List>
      </Drawer>
    </>
  );
}

function MobileDarkModeToggle() {
  const { mode, toggleMode } = useColorMode();
  return (
    <ListItemButton onClick={toggleMode} sx={{ borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
      <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
        {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </ListItemIcon>
      <ListItemText
        primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        primaryTypographyProps={{ color: 'white' }}
      />
    </ListItemButton>
  );
}
