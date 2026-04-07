'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { QuestionnaireState } from '@/types/questionnaire';
import type { GameType } from '@/types/game';
import type { TimePreset } from '@/types/questionnaire';
import { INITIAL_STATE, GENRE_OPTIONS, MOOD_OPTIONS } from '@/types/questionnaire';
import { saveGuestPreferences, getGuestPreferences } from '@/lib/guest';
import type { ParsedPreferences } from '@/lib/llm/types';
import GameTypeStep from '@/components/questionnaire/GameTypeStep';
import TimeStep from '@/components/questionnaire/TimeStep';
import ComplexityStep from '@/components/questionnaire/ComplexityStep';
import GenreStep from '@/components/questionnaire/GenreStep';
import MoodStep from '@/components/questionnaire/MoodStep';
import FreeTextStep from '@/components/questionnaire/FreeTextStep';
import { getFilteredMoods, getFilteredGenres, getMoodDescription } from '@/lib/questionnaire-context';
import { useAchievements } from '@/components/AchievementToast';
import { motion, AnimatePresence } from 'motion/react';
import OnboardingDialog from '@/components/OnboardingDialog';
import JsonLd from '@/components/JsonLd';

// Free text is now FIRST — LLM parses it to pre-fill subsequent steps
const STEPS = [
  { key: 'freeText', title: 'What are you looking for?' },
  { key: 'gameTypes', title: 'What kind of game?' },
  { key: 'timePresets', title: 'How much time do you have?' },
  { key: 'complexity', title: 'How complex?' },
  { key: 'genres', title: 'Pick genres you like' },
  { key: 'moods', title: "What's the vibe?" },
] as const;

const VALID_GAME_TYPES = new Set(['board', 'video', 'word', 'party', 'card']);
const VALID_TIME_PRESETS = new Set(['quick', 'short', 'medium', 'long', 'epic']);
const VALID_GENRES = new Set(GENRE_OPTIONS);
const VALID_MOODS: Set<string> = new Set(MOOD_OPTIONS.map((m) => m.id));

export default function QuestionnaireFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuestionnaireState>(INITIAL_STATE);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { unlock } = useAchievements();

  // Load guest preferences from localStorage on mount + check auth
  useEffect(() => {
    const saved = getGuestPreferences();
    if (saved) {
      setState((prev) => ({ ...prev, ...saved }));
    }
    // Check if logged in for collection-only feature
    import('@/lib/supabase/client').then(({ getCachedUser }) => {
      getCachedUser().then((user) => {
        setIsLoggedIn(!!user);
      });
    });
  }, []);

  const totalSteps = STEPS.length;
  const isLast = step === totalSteps - 1;
  const isFreeTextStep = step === 0;

  function update(partial: Partial<QuestionnaireState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  /**
   * Merge LLM-parsed preferences into the questionnaire state.
   * Only sets values that are valid against our known enums.
   */
  function mergeWithParsed(parsed: ParsedPreferences) {
    // Fuzzy genre matching: map LLM genres + DB categories to our UI options
    const genreMap = new Map(GENRE_OPTIONS.map((g) => [g.toLowerCase(), g]));
    const matchedGenres = new Set<string>();
    for (const g of [...parsed.genres, ...parsed.mechanics]) {
      const lower = g.toLowerCase();
      // Exact match
      if (genreMap.has(lower)) {
        matchedGenres.add(genreMap.get(lower)!);
        continue;
      }
      // Substring match: "Abstract Strategy" → "Strategy"
      for (const [key, val] of genreMap) {
        if (lower.includes(key) || key.includes(lower)) {
          matchedGenres.add(val);
        }
      }
    }

    setState((prev) => {
      // User's explicit chip selection is a 100% hard filter — it ALWAYS wins
      // over LLM inference. Only use LLM types if user didn't click a chip.
      const userClickedType = prev.gameTypes.length > 0;
      const llmTypes = parsed.gameTypes.length > 0
        ? parsed.gameTypes.filter((t) => VALID_GAME_TYPES.has(t)) as GameType[]
        : INITIAL_STATE.gameTypes;
      const userPickedPlayers = prev.playerCount.min !== INITIAL_STATE.playerCount.min
        || prev.playerCount.max !== INITIAL_STATE.playerCount.max;

      return {
        ...prev,
        // Reset to INITIAL_STATE defaults when LLM doesn't specify a value,
        // so stale slider/chip state from a previous search doesn't carry over.
        gameTypes: userClickedType ? prev.gameTypes : llmTypes,
        playerCount: userPickedPlayers ? prev.playerCount : INITIAL_STATE.playerCount,
        timePresets: parsed.timePresets.length > 0
          ? parsed.timePresets.filter((t) => VALID_TIME_PRESETS.has(t)) as TimePreset[]
          : INITIAL_STATE.timePresets,
        complexity: parsed.complexity ?? INITIAL_STATE.complexity,
        genres: matchedGenres.size > 0 ? [...matchedGenres] : INITIAL_STATE.genres,
        moods: parsed.moods.length > 0
          ? parsed.moods.filter((m) => VALID_MOODS.has(m))
          : INITIAL_STATE.moods,
        llmParsed: parsed,
      };
    });
  }

  /**
   * Call the LLM to parse free text into structured preferences.
   * Returns true if parsing succeeded, false otherwise.
   */
  async function parseFreeText(): Promise<boolean> {
    if (!state.freeText.trim() || state.freeText.trim().length < 3) return false;

    setIsParsing(true);
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.freeText.trim() }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.parsed) {
        mergeWithParsed(data.parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsParsing(false);
    }
  }

  async function next() {
    if (isLast) {
      submit();
      return;
    }

    // If leaving the free text step with text, parse it
    if (isFreeTextStep && state.freeText.trim().length >= 3) {
      await parseFreeText();
    }

    setStep((s) => s + 1);
  }

  function skip() {
    if (isLast) {
      submit();
    } else {
      setStep((s) => s + 1);
    }
  }

  /**
   * Skip the entire questionnaire — parse free text and go straight to results.
   * Only available on the free text step when text is entered.
   */
  async function quickSubmit() {
    if (!state.freeText.trim()) return;
    setIsParsing(true);
    unlock('first_search');

    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.freeText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.parsed) {
          // Merge parsed data with INITIAL_STATE defaults, not stale UI state.
          // When the user types a new free text prompt, old slider/chip values
          // from a previous search should not carry over and constrain results.
          const parsedTypes = (data.parsed.gameTypes ?? []).filter((t: string) => VALID_GAME_TYPES.has(t)) as GameType[];
          const parsedTime = (data.parsed.timePresets ?? []).filter((t: string) => VALID_TIME_PRESETS.has(t)) as TimePreset[];
          // User's explicit chip selection is a 100% hard filter — it ALWAYS wins
          // over LLM inference. E.g. clicking "Board" then typing "resident evil"
          // must return only board games, even though the LLM infers "video".
          const userClickedType = state.gameTypes.length > 0;
          // User explicitly picked a player count if it differs from INITIAL_STATE
          // (either a specific number like {3,3} or the deselected {1,10}).
          const userPickedPlayers = state.playerCount.min !== INITIAL_STATE.playerCount.min
            || state.playerCount.max !== INITIAL_STATE.playerCount.max;
          const merged = {
            ...INITIAL_STATE,
            freeText: state.freeText,
            gameTypes: userClickedType ? state.gameTypes : (parsedTypes.length > 0 ? parsedTypes : INITIAL_STATE.gameTypes),
            playerCount: userPickedPlayers ? state.playerCount : INITIAL_STATE.playerCount,
            timePresets: parsedTime.length > 0 ? parsedTime : INITIAL_STATE.timePresets,
            complexity: data.parsed.complexity ?? INITIAL_STATE.complexity,
            genres: data.parsed.genres?.length > 0 ? data.parsed.genres : INITIAL_STATE.genres,
            moods: data.parsed.moods?.length > 0 ? data.parsed.moods : INITIAL_STATE.moods,
            llmParsed: data.parsed,
          };
          // Build clean URL params — only explicit user selections.
          // LLM parsing happens server-side in /api/recommend.
          const params = new URLSearchParams();
          params.set('freeText', state.freeText.trim());
          if (merged.gameTypes.length > 0) params.set('types', merged.gameTypes.join(','));
          if (merged.playerCount.min > 1 || merged.playerCount.max < 10) {
            params.set('players', `${merged.playerCount.min}-${merged.playerCount.max}`);
          }
          if (merged.timePresets.length > 0) params.set('time', merged.timePresets.join(','));
          if (merged.complexity.min > 1 || merged.complexity.max < 5) {
            params.set('complexity', `${merged.complexity.min}-${merged.complexity.max}`);
          }
          if (merged.genres.length > 0) params.set('genres', merged.genres.join(','));
          if (merged.moods.length > 0) params.set('moods', merged.moods.join(','));
          if (collectionOnly) params.set('collectionOnly', '1');

          saveGuestPreferences(merged as unknown as Record<string, unknown>);
          router.push(`/results?${params.toString()}`);
          return;
        }
      }
    } catch {
      // Fall through to regular submit
    } finally {
      setIsParsing(false);
    }

    // LLM failed — submit with just the free text
    submit();
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function savePreset() {
    if (!presetName.trim()) return;
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), preferences: state }),
      });
      if (res.ok) {
        // Check preset count for achievements
        fetch('/api/presets').then((r) => r.json()).then((data) => {
          const count = data.presets?.length ?? 0;
          if (count >= 3) unlock('game_group');
          if (count >= 5) unlock('organized');
        }).catch(() => {});
      }
    } catch { /* silently fail if not logged in */ }
    setSaveDialogOpen(false);
    setPresetName('');
  }

  function submit() {
    saveGuestPreferences(state as unknown as Record<string, unknown>);
    unlock('first_search');

    // Wordsmith: long free text prompt
    if (state.freeText.trim().length > 100) unlock('wordsmith');

    // Genre hopper: 5+ game types searched (tracked via localStorage)
    if (state.gameTypes.length > 0) {
      const searched = JSON.parse(localStorage.getItem('rag_searched_types') ?? '[]');
      const updated = [...new Set([...searched, ...state.gameTypes])];
      localStorage.setItem('rag_searched_types', JSON.stringify(updated));
      if (updated.length >= 5) unlock('genre_hopper');
    }

    // Easter eggs in free text
    const lower = state.freeText.toLowerCase();
    if (lower.includes('42') || lower.includes('meaning of life') || lower.includes('answer to life')) {
      unlock('forty_two');
    }
    if (lower.includes('never gonna give you up') || lower.includes('rick roll') || lower.includes('rickroll')) {
      unlock('rick_rolled');
    }

    // Count active filters for picky_player achievement
    const filterCount = [
      state.gameTypes.length > 0,
      state.playerCount.min > 1 || state.playerCount.max < 10,
      state.timePresets.length > 0,
      state.complexity.min > 1 || state.complexity.max < 5,
      state.genres.length > 0,
      state.moods.length > 0,
      state.freeText.trim().length > 0,
    ].filter(Boolean).length;
    if (filterCount >= 5) unlock('picky_player');

    const params = new URLSearchParams();

    if (state.freeText.trim()) params.set('freeText', state.freeText.trim());
    if (state.gameTypes.length > 0) params.set('types', state.gameTypes.join(','));
    if (state.playerCount.min > 1 || state.playerCount.max < 10) {
      params.set('players', `${state.playerCount.min}-${state.playerCount.max}`);
    }
    if (state.timePresets.length > 0) params.set('time', state.timePresets.join(','));
    if (state.complexity.min > 1 || state.complexity.max < 5) {
      params.set('complexity', `${state.complexity.min}-${state.complexity.max}`);
    }
    if (state.genres.length > 0) params.set('genres', state.genres.join(','));
    if (state.moods.length > 0) params.set('moods', state.moods.join(','));
    if (collectionOnly) params.set('collectionOnly', '1');

    router.push(`/results?${params.toString()}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <FreeTextStep
            value={state.freeText}
            onChange={(v) => update({ freeText: v })}
            playerCount={state.playerCount}
            onPlayerCountChange={(v) => update({ playerCount: v })}
            gameTypes={state.gameTypes}
            onGameTypesChange={(v) => update({ gameTypes: v })}
            collectionOnly={collectionOnly}
            onCollectionOnlyChange={setCollectionOnly}
            isLoggedIn={isLoggedIn}
            onQuickSubmit={quickSubmit}
            onCustomize={next}
            isParsing={isParsing}
          />
        );
      case 1:
        return <GameTypeStep value={state.gameTypes} onChange={(v) => update({ gameTypes: v })} />;
      case 2:
        return <TimeStep value={state.timePresets} onChange={(v) => update({ timePresets: v })} />;
      case 3:
        return <ComplexityStep value={state.complexity} onChange={(v) => update({ complexity: v })} />;
      case 4:
        return <GenreStep value={state.genres} onChange={(v) => update({ genres: v })} filteredGenres={getFilteredGenres(state)} />;
      case 5: {
        const filteredMoods = getFilteredMoods(state);
        const descOverrides: Record<string, string> = {};
        for (const m of filteredMoods) {
          const custom = getMoodDescription(m.id, state);
          if (custom !== m.description) descOverrides[m.id] = custom;
        }
        return <MoodStep value={state.moods} onChange={(v) => update({ moods: v })} filteredMoods={filteredMoods} descriptionOverrides={descOverrides} />;
      }
      default:
        return null;
    }
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Game Recommendation Finder',
        url: 'https://boredgame.lol/find-a-game',
        applicationCategory: 'Entertainment',
        operatingSystem: 'Web',
        description: 'Tell us what you\'re in the mood for and our AI recommendation engine will find your next favorite game from 80,000+ board games, video games, word games, and party games.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        creator: { '@type': 'Organization', name: 'boredgame.lol', url: 'https://boredgame.lol' },
      }} />
      <OnboardingDialog />
      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: { xs: 3, md: 8, lg: 10 }, pb: 12 }}>
        {/* Progress — hidden on free text step, shows steps 1-6 for the filter steps */}
        {!isFreeTextStep && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress variant="determinate" value={((step) / (totalSteps - 1)) * 100} sx={{ borderRadius: 1, height: 6 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
              {step} of {totalSteps - 1}
            </Typography>
          </Box>
        )}

        {/* Step Title + Content with slide animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.125rem' } }}>
              {STEPS[step].title}
            </Typography>
            {isFreeTextStep && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Describe what you&apos;re looking for and we&apos;ll take care of the rest!
              </Typography>
            )}
            <Box>
              {renderStep()}
            </Box>
          </motion.div>
        </AnimatePresence>
      </Container>

      {/* Sticky Navigation — hidden on free text step (buttons are inline) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          py: 2,
          px: 2,
          zIndex: 10,
          display: isFreeTextStep ? 'none' : 'block',
        }}
      >
        <Container maxWidth="sm">
          <Stack direction="row" spacing={2}>
            <Button
              variant="text"
              onClick={back}
              disabled={step === 0}
              sx={{ minWidth: 80 }}
            >
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
            {isLast && (
              <Button
                variant="text"
                onClick={() => setSaveDialogOpen(true)}
                sx={{ minWidth: 80 }}
              >
                Save Preset
              </Button>
            )}
            <Button variant="text" onClick={skip} sx={{ minWidth: 80 }}>
              {isLast ? '' : 'Skip'}
            </Button>
            <Button
              variant="contained"
              onClick={next}
              disabled={isParsing}
              sx={{ minWidth: 140 }}
            >
              {isLast ? 'Find Games' : 'Next'}
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Preferences as Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Preset Name"
            placeholder='e.g. "Family Game Night" or "Solo Strategy"'
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={savePreset} disabled={!presetName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
