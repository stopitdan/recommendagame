'use client';

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, getRarityColor, type Achievement } from '@/lib/achievements';

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
  const isLoggedIn = useRef(false);

  // Konami code listener: ↑↑↓↓←→←→BA
  const konamiBuffer = useRef<string[]>([]);
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      konamiBuffer.current.push(e.key);
      if (konamiBuffer.current.length > 10) konamiBuffer.current.shift();
      if (konamiBuffer.current.join(',') === KONAMI.join(',')) {
        unlock('konami_code');
        konamiBuffer.current = [];
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setTimeout(() => unlock('night_owl'), 3000);
        }

        // Veteran + Founding Member (check account age)
        fetch('/api/profile').then((r) => r.json()).then((profile) => {
          isLoggedIn.current = !!profile.created_at;
          if (profile.created_at) {
            const created = new Date(profile.created_at).getTime();
            const now = Date.now();
            const daysSinceCreation = (now - created) / 86400000;
            if (daysSinceCreation >= 30) setTimeout(() => unlock('veteran'), 5000);
            // Founding member: account created before Aug 2026 (first month)
            if (new Date(profile.created_at) < new Date('2026-08-01')) {
              setTimeout(() => unlock('founding_member'), 6000);
            }
          }
        }).catch(() => {});

        // Loyal fan: 7 day visit streak
        const today = new Date().toISOString().slice(0, 10);
        const visitDays: string[] = JSON.parse(localStorage.getItem('rag_visit_days') ?? '[]');
        if (!visitDays.includes(today)) {
          visitDays.push(today);
          // Keep last 30 days only
          const recent = visitDays.slice(-30);
          localStorage.setItem('rag_visit_days', JSON.stringify(recent));
          // Check for 7 consecutive days
          if (recent.length >= 7) {
            const last7 = recent.slice(-7);
            const d0 = new Date(last7[0]).getTime();
            const d6 = new Date(last7[6]).getTime();
            if (d6 - d0 <= 7 * 86400000) {
              setTimeout(() => unlock('loyal_fan'), 4000);
            }
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track unique features used this session for power_user achievement
  const sessionFeatures = useRef(new Set<string>());

  // Use a ref for dedup to avoid stale closure issues with useCallback
  const unlockedRef = useRef(unlockedSet);
  unlockedRef.current = unlockedSet;

  const unlock = useCallback((achievementId: string) => {
    // Not logged in? Skip entirely
    if (!isLoggedIn.current) return;

    // Already unlocked? Skip (check ref to avoid stale closure)
    if (unlockedRef.current.has(achievementId)) return;

    const achievement = ACHIEVEMENT_MAP.get(achievementId);
    if (!achievement) return;

    // Track feature usage for power_user
    sessionFeatures.current.add(achievementId);
    if (sessionFeatures.current.size >= 10 && achievementId !== 'power_user') {
      setTimeout(() => unlock('power_user'), 4500);
    }

    // Optimistically mark as unlocked (both ref and state)
    setUnlockedSet((prev) => {
      const next = new Set([...prev, achievementId]);
      unlockedRef.current = next;
      return next;
    });

    // Show toast
    setToast(achievement);
    setTimeout(() => setToast(null), 4000);

    // Check for completionist+
    const newSet = new Set([...unlockedRef.current, achievementId]);
    const allOthers = ACHIEVEMENTS.filter((a) => a.id !== 'completionist_plus');
    if (allOthers.every((a) => newSet.has(a.id)) && achievementId !== 'completionist_plus') {
      setTimeout(() => unlock('completionist_plus'), 5000);
    }

    // Persist to server (best-effort, ignore errors)
    fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
