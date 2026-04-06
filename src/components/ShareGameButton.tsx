'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { Share2, ClipboardCopy, Link2, MessageCircle, Globe, Check } from 'lucide-react';

interface ShareGameButtonProps {
  gameId: string;
  gameName: string;
}

export default function ShareGameButton({ gameId, gameName }: ShareGameButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const open = Boolean(anchorEl);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/games/${encodeURIComponent(gameId)}`
    : '';
  const shareText = `Check out ${gameName} on boredgame.lol!`;

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    if (navigator.share) {
      navigator.share({ title: gameName, text: shareText, url }).catch(() => {
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
      <Tooltip title="Share this game">
        <Button
          variant="outlined"
          size="small"
          onClick={handleClick}
          sx={{ minWidth: 0, px: 1.5 }}
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
        </Button>
      </Tooltip>
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
