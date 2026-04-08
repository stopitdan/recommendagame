'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import type { Game } from '@/types/game';
import { amazonUrl, targetUrl, walmartUrl, gamenerdzUrl } from '@/lib/affiliate-config';

interface BuyOptionsProps {
  game: Game;
}

interface StoreLink {
  label: string;
  url: string;
  primary?: boolean;
}

function getStoreLinks(game: Game): StoreLink[] {
  const name = encodeURIComponent(game.name);
  const isVideo = game.types.includes('video');
  const isBgg = game.source === 'bgg';
  const links: StoreLink[] = [];

  // Amazon affiliate -- always first
  links.push({
    label: 'Amazon',
    url: amazonUrl(game.name),
    primary: true,
  });

  if (isVideo) {
    links.push({ label: 'Steam', url: `https://store.steampowered.com/search/?term=${name}` });
    links.push({ label: 'GOG', url: `https://www.gog.com/games?query=${name}` });
    links.push({ label: 'Epic Games', url: `https://store.epicgames.com/browse?q=${name}` });
  } else {
    // Board game stores
    if (isBgg && game.sourceId) {
      links.push({ label: 'BGG Market', url: `https://boardgamegeek.com/boardgame/${game.sourceId}/marketplace` });
    }
    links.push({ label: 'Target', url: targetUrl(game.name) });
    links.push({ label: 'Walmart', url: walmartUrl(game.name) });
    links.push({ label: 'GameNerdz', url: gamenerdzUrl(game.name) });
  }

  return links;
}

/**
 * Compact buy chip with a dropdown menu showing multiple store options.
 * Replaces the single "Buy" chip on GameCard.
 */
export default function BuyOptions({ game }: BuyOptionsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const links = getStoreLinks(game);

  return (
    <>
      <Chip
        icon={<ShoppingCart size={12} /> as React.ReactElement}
        label="Buy"
        size="small"
        color="secondary"
        variant="outlined"
        clickable
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
        sx={{ ml: 'auto' }}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { minWidth: 180, borderRadius: 2 } } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 0.5, mb: 0.5 }}>
          <Box sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Find best price
          </Box>
        </Box>
        {links.map((link) => (
          <MenuItem
            key={link.label}
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAnchorEl(null)}
            sx={{ fontSize: '0.875rem' }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {link.primary ? <ShoppingCart size={16} /> : <ExternalLink size={16} />}
            </ListItemIcon>
            <ListItemText>{link.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
