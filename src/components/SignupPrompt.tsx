'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crosshair } from 'lucide-react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import { shouldShowSignupPrompt, dismissSignupPrompt } from '@/lib/guest';
import { createClient } from '@/lib/supabase/client';

/**
 * Signup prompt that appears after N guest recommendations.
 * Non-blocking — user can dismiss and continue using the app.
 */
export default function SignupPrompt() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check after a short delay so it doesn't flash on page load
    const timer = setTimeout(async () => {
      // Don't show if user is already logged in
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return;

      if (shouldShowSignupPrompt()) {
        setOpen(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    dismissSignupPrompt();
    setOpen(false);
  }

  function handleSignup() {
    dismissSignupPrompt();
    setOpen(false);
    router.push('/signup');
  }

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          open={open}
          onClose={handleDismiss}
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
              <Box sx={{ color: 'primary.main' }}><Crosshair size={48} strokeWidth={1.5} /></Box>
              <Typography variant="h5" fontWeight={800}>
                Enjoying the recommendations?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Create a free account to save your favorites, write reviews,
                save preference presets, and get smarter recommendations
                that learn from your taste over time.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1, width: '100%' }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleDismiss}
                  sx={{ py: 1.2 }}
                >
                  Maybe Later
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSignup}
                  sx={{ py: 1.2 }}
                >
                  Sign Up Free
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                You can continue using the app without an account
              </Typography>
            </Stack>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
