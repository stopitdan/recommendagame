'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { User, Heart, ClipboardList, Settings, LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

export interface HeaderAuthProps {
  isLoggedIn: boolean;
  email: string;
  displayName?: string;
}

export default function HeaderAuth({ isLoggedIn, email, displayName }: HeaderAuthProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  if (isLoggedIn) {
    const initials = (displayName || email || '?')
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join('');

    return (
      <>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          aria-label="User menu"
          sx={{
            ml: 1,
            border: '2px solid rgba(255,255,255,0.2)',
            transition: 'all 200ms ease',
            '&:hover': { borderColor: 'rgba(255,255,255,0.5)' },
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FF6D3F, #5B4FDB)',
            }}
          >
            {initials}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={() => setAnchorEl(null)}
          onClick={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              elevation: 8,
              sx: {
                mt: 1.5,
                minWidth: 200,
                borderRadius: 2,
                overflow: 'visible',
                '&::before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {displayName || 'Player'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {email}
            </Typography>
          </Box>

          <Divider />

          <MenuItem onClick={() => router.push('/profile')}>
            <ListItemIcon sx={{ minWidth: 32 }}><User size={18} /></ListItemIcon>
            <ListItemText>My Profile</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => router.push('/favorites')}>
            <ListItemIcon sx={{ minWidth: 32 }}><Heart size={18} /></ListItemIcon>
            <ListItemText>Favorites</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => router.push('/presets')}>
            <ListItemIcon sx={{ minWidth: 32 }}><ClipboardList size={18} /></ListItemIcon>
            <ListItemText>Saved Presets</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => router.push('/settings')}>
            <ListItemIcon sx={{ minWidth: 32 }}><Settings size={18} /></ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>

          <Divider />

          <MenuItem
            onClick={() => {
              const form = document.createElement('form');
              form.action = '/api/auth/logout';
              form.method = 'POST';
              document.body.appendChild(form);
              // Use the server action directly
              logout();
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}><LogOut size={18} /></ListItemIcon>
            <ListItemText>Log Out</ListItemText>
          </MenuItem>
        </Menu>
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Button
        variant="text"
        size="small"
        onClick={() => router.push('/login')}
        sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#FFFFFF' } }}
      >
        Log In
      </Button>
      <Button
        variant="contained"
        size="small"
        onClick={() => router.push('/signup')}
        sx={{
          background: 'linear-gradient(135deg, #FF6D3F, #FF8F6B)',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(255, 109, 63, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #E85A2E, #FF6D3F)',
            boxShadow: '0 4px 12px rgba(255, 109, 63, 0.4)',
          },
        }}
      >
        Sign Up
      </Button>
    </Box>
  );
}
