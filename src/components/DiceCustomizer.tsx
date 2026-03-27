'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import { DICE_SKINS, type DiceSkin } from '@/lib/dice-skins';

/** CSS keyframes for animated swatch previews — injected once */
const SWATCH_KEYFRAMES = `
@keyframes swatch-fire {
  0% { background-position: 50% 100%; }
  100% { background-position: 50% 0%; }
}
@keyframes swatch-water {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
@keyframes swatch-galaxy {
  0% { transform: scale(1); filter: hue-rotate(0deg); }
  50% { transform: scale(1.05); filter: hue-rotate(30deg); }
  100% { transform: scale(1); filter: hue-rotate(0deg); }
}
@keyframes swatch-holo {
  0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
  100% { background-position: 100% 50%; filter: hue-rotate(360deg); }
}
@keyframes swatch-electric {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; box-shadow: 0 0 6px #4488FF; }
}
@keyframes swatch-toxic {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; box-shadow: 0 0 6px #33FF00; }
}
@keyframes swatch-magma {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; box-shadow: 0 0 6px #FF4400; }
}
@keyframes swatch-frost {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; box-shadow: 0 0 5px #88CCEE; }
}
@keyframes swatch-disco {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
@keyframes swatch-blood {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; box-shadow: 0 0 5px #880000; }
}
`;

interface DiceCustomizerProps {
  activeSkinId: string;
  isLoggedIn: boolean;
  onSelect: (skin: DiceSkin) => void;
  /** When true, renders as a narrow vertical strip (2-3 columns) instead of a wide row */
  vertical?: boolean;
}

/**
 * Dice skin picker — shows a grid of color/effect swatches.
 * Animated swatches preview the shader effects.
 * Locked skins show a lock icon and prompt signup for guests.
 */
export default function DiceCustomizer({ activeSkinId, isLoggedIn, onSelect, vertical }: DiceCustomizerProps) {
  const router = useRouter();
  const [signupOpen, setSignupOpen] = useState(false);

  // Inject swatch animation keyframes once
  useEffect(() => {
    if (document.getElementById('dice-swatch-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'dice-swatch-keyframes';
    style.textContent = SWATCH_KEYFRAMES;
    document.head.appendChild(style);
  }, []);

  function handleSelect(skin: DiceSkin) {
    if (skin.requiresAccount && !isLoggedIn) {
      setSignupOpen(true);
      return;
    }
    onSelect(skin);
  }

  return (
    <>
      <Box sx={{ width: vertical ? 'auto' : '100%', maxWidth: vertical ? undefined : 440 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 1, display: 'block', textAlign: vertical ? 'center' : undefined }}
        >
          Customize your dice
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: vertical ? 'repeat(3, 34px)' : 'repeat(auto-fill, 34px)',
            gap: 0.8,
            justifyContent: 'center',
            justifyItems: 'center',
          }}
        >
          {DICE_SKINS.map((skin) => {
            const isActive = skin.id === activeSkinId;
            const isLocked = skin.requiresAccount && !isLoggedIn;

            return (
              <Tooltip
                key={skin.id}
                title={`${skin.emoji} ${skin.name}${isLocked ? ' — sign up to unlock!' : ''}`}
              >
                <IconButton
                  onClick={() => handleSelect(skin)}
                  sx={{
                    width: 34,
                    height: 34,
                    p: 0,
                    border: isActive ? '2.5px solid' : '2px solid transparent',
                    borderColor: isActive ? 'primary.main' : 'transparent',
                    borderRadius: '50%',
                    transition: 'all 150ms ease',
                    position: 'relative',
                    '&:hover': {
                      transform: 'scale(1.2)',
                      borderColor: isActive ? 'primary.main' : 'divider',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: skin.swatchBg,
                      backgroundSize: skin.swatchAnimation ? '200% 200%' : undefined,
                      animation: skin.swatchAnimation
                        ? `${skin.swatchAnimation} ${
                            skin.swatchAnimation === 'swatch-fire' ? '1.5s' :
                            skin.swatchAnimation === 'swatch-holo' ? '3s' :
                            skin.swatchAnimation === 'swatch-disco' ? '4s' :
                            '2s'
                          } ease infinite`
                        : undefined,
                      opacity: isLocked ? 0.45 : 1,
                    }}
                  />
                  {isLocked && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        fontSize: '0.6rem',
                        lineHeight: 1,
                      }}
                    >
                      🔒
                    </Box>
                  )}
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* Signup prompt dialog for guests trying to use premium skins */}
      <AnimatePresence>
        {signupOpen && (
          <Dialog
            open={signupOpen}
            onClose={() => setSignupOpen(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              component: motion.div,
              initial: { opacity: 0, y: 40, scale: 0.95 },
              animate: { opacity: 1, y: 0, scale: 1 },
              exit: { opacity: 0, y: 20, scale: 0.95 },
              transition: { type: 'spring', damping: 20, stiffness: 300 },
            } as any}
          >
            <DialogContent sx={{ p: 4, textAlign: 'center' }}>
              <Stack spacing={2.5} alignItems="center">
                <Typography sx={{ fontSize: '3.5rem' }}>🎨</Typography>
                <Typography variant="h5" fontWeight={800}>
                  Unlock Custom Dice Skins
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Create a free account to customize your dice and unlock all these perks:
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    textAlign: 'left',
                    pl: 2,
                    m: 0,
                    '& li': {
                      mb: 1,
                      color: 'text.secondary',
                      fontSize: '0.95rem',
                    },
                  }}
                >
                  <li><strong>20+ unique dice skins</strong> — fire, galaxy, holographic, emoji, and more</li>
                  <li><strong>Animated effects</strong> — your dice come alive with shaders</li>
                  <li><strong>Save your favorites</strong> — bookmark games you love</li>
                  <li><strong>Smarter recommendations</strong> — the engine learns your taste</li>
                  <li><strong>Track achievements</strong> — unlock badges as you roll</li>
                  <li><strong>Write reviews</strong> — share your thoughts on games</li>
                  <li><strong>Save preference presets</strong> — switch between moods instantly</li>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1, width: '100%' }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setSignupOpen(false)}
                    sx={{ py: 1.2 }}
                  >
                    Maybe Later
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      setSignupOpen(false);
                      router.push('/signup');
                    }}
                    sx={{ py: 1.2 }}
                  >
                    Sign Up Free
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Takes 30 seconds — no credit card needed
                </Typography>
              </Stack>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
