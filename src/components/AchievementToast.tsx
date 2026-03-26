'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import { ACHIEVEMENT_MAP, getRarityColor, type Achievement } from '@/lib/achievements';

// ─── Context for triggering toasts from anywhere ─────────────

interface AchievementContextType {
  unlock: (achievementId: string) => void;
}

const AchievementContext = createContext<AchievementContextType>({
  unlock: () => {},
});

export function useAchievements() {
  return useContext(AchievementContext);
}

// ─── Provider ────────────────────────────────────────────────

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Achievement | null>(null);
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());

  // Load unlocked achievements on mount + check night owl
  useEffect(() => {
    fetch('/api/achievements')
      .then((r) => r.json())
      .then((data) => {
        const ids = (data.achievements ?? []).map((a: { achievement_id: string }) => a.achievement_id);
        setUnlockedSet(new Set(ids));

        // Night owl: using the app between midnight and 4am
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4 && !ids.includes('night_owl')) {
          // Delay so the toast doesn't fire immediately on page load
          setTimeout(() => unlock('night_owl'), 3000);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback((achievementId: string) => {
    // Already unlocked? Skip
    if (unlockedSet.has(achievementId)) return;

    const achievement = ACHIEVEMENT_MAP.get(achievementId);
    if (!achievement) return;

    // Optimistically mark as unlocked
    setUnlockedSet((prev) => new Set([...prev, achievementId]));

    // Show toast
    setToast(achievement);
    setTimeout(() => setToast(null), 4000);

    // Persist to server (best-effort)
    fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId }),
    }).catch(() => {});
  }, [unlockedSet]);

  return (
    <AchievementContext.Provider value={{ unlock }}>
      {children}
      <AnimatePresence>
        {toast && <AchievementToastUI achievement={toast} />}
      </AnimatePresence>
    </AchievementContext.Provider>
  );
}

// ─── Toast UI ────────────────────────────────────────────────

function AchievementToastUI({ achievement }: { achievement: Achievement }) {
  const rarityColor = getRarityColor(achievement.rarity);

  return (
    <motion.div
      initial={{ opacity: 0, y: -60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: `2px solid ${rarityColor}`,
          boxShadow: `0 8px 30px ${rarityColor}30, 0 4px 12px rgba(0,0,0,0.1)`,
          minWidth: 280,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: '2rem', lineHeight: 1 }}
        >
          {achievement.emoji}
        </motion.div>
        <Box>
          <Typography variant="overline" sx={{ color: rarityColor, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1.2 }}>
            Achievement Unlocked!
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {achievement.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {achievement.description}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}
