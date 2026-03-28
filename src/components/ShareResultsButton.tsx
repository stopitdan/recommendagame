'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Link2, ClipboardCopy, Share2, MessageCircle, Globe } from 'lucide-react';

interface ShareResultsButtonProps {
  /** Names of the top games to include in share text */
  gameNames: string[];
}

export default function ShareResultsButton({ gameNames }: ShareResultsButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const open = Boolean(anchorEl);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const topGames = gameNames.slice(0, 3);
  const shareText = topGames.length > 0
    ? `boredgame.lol recommended me ${topGames.join(', ')}${gameNames.length > 3 ? ` and ${gameNames.length - 3} more` : ''}! Find your next favorite game:`
    : 'Check out my game recommendations from boredgame.lol!';

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    // Try Web Share API first (mobile)
    if (navigator.share) {
      navigator.share({ title: 'My Game Recommendations', text: shareText, url }).catch(() => {
        // User cancelled or API failed — fall back to menu
        setAnchorEl(event.currentTarget);
      });
    } else {
      setAnchorEl(event.currentTarget);
    }
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    handleClose();
  }

  function handleTwitter() {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
    handleClose();
  }

  function handleFacebook() {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank', 'width=600,height=400');
    handleClose();
  }

  function handleReddit() {
    const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(shareText)}`;
    window.open(redditUrl, '_blank', 'width=800,height=600');
    handleClose();
  }

  return (
    <>
      <Button variant="outlined" size="small" onClick={handleClick} startIcon={<Share2 size={16} />}>
        {copied ? 'Link Copied!' : 'Share'}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon><ClipboardCopy size={18} /></ListItemIcon>
          <ListItemText>Copy Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleTwitter}>
          <ListItemIcon><MessageCircle size={18} /></ListItemIcon>
          <ListItemText>Share on X / Twitter</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleFacebook}>
          <ListItemIcon><Globe size={18} /></ListItemIcon>
          <ListItemText>Share on Facebook</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleReddit}>
          <ListItemIcon><Link2 size={18} /></ListItemIcon>
          <ListItemText>Share on Reddit</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
