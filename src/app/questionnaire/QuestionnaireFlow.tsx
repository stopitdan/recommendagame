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
import PlayerCountStep from '@/components/questionnaire/PlayerCountStep';
import TimeStep from '@/components/questionnaire/TimeStep';
import ComplexityStep from '@/components/questionnaire/ComplexityStep';
import GenreStep from '@/components/questionnaire/GenreStep';
import MoodStep from '@/components/questionnaire/MoodStep';
import FreeTextStep from '@/components/questionnaire/FreeTextStep';
import { getFilteredMoods, getFilteredGenres, getMoodDescription } from '@/lib/questionnaire-context';
import { motion, AnimatePresence } from 'motion/react';

// Free text is now FIRST — LLM parses it to pre-fill subsequent steps
const STEPS = [
  { key: 'freeText', title: 'What are you looking for?' },
  { key: 'gameTypes', title: 'What kind of game?' },
  { key: 'playerCount', title: 'How many players?' },
  { key: 'timePresets', title: 'How much time do you have?' },
  { key: 'complexity', title: 'How complex?' },
  { key: 'genres', title: 'Pick genres you like' },
  { key: 'moods', title: "What's the vibe?" },
] as const;

const VALID_GAME_TYPES = new Set(['board', 'video', 'word', 'party', 'card']);
const VALID_TIME_PRESETS = new Set(['quick', 'short', 'medium', 'long', 'epic']);
const VALID_GENRES = new Set(GENRE_OPTIONS);
const VALID_MOODS = new Set(MOOD_OPTIONS.map((m) => m.id));

export default function QuestionnaireFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuestionnaireState>(INITIAL_STATE);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // Load guest preferences from localStorage on mount
  useEffect(() => {
    const saved = getGuestPreferences();
    if (saved) {
      setState((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
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

    setState((prev) => ({
      ...prev,
      gameTypes: parsed.gameTypes.length > 0
        ? parsed.gameTypes.filter((t) => VALID_GAME_TYPES.has(t)) as GameType[]
        : prev.gameTypes,
      playerCount: parsed.playerCount ?? prev.playerCount,
      timePresets: parsed.timePresets.length > 0
        ? parsed.timePresets.filter((t) => VALID_TIME_PRESETS.has(t)) as TimePreset[]
        : prev.timePresets,
      complexity: parsed.complexity ?? prev.complexity,
      genres: matchedGenres.size > 0 ? [...matchedGenres] : prev.genres,
      moods: parsed.moods.length > 0
        ? parsed.moods.filter((m) => VALID_MOODS.has(m))
        : prev.moods,
      llmParsed: parsed,
    }));
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

    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.freeText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.parsed) {
          // Merge parsed data into state, then submit immediately
          const merged = {
            ...state,
            gameTypes: data.parsed.gameTypes?.filter((t: string) => VALID_GAME_TYPES.has(t)) as GameType[] ?? state.gameTypes,
            playerCount: data.parsed.playerCount ?? state.playerCount,
            timePresets: data.parsed.timePresets?.filter((t: string) => VALID_TIME_PRESETS.has(t)) as TimePreset[] ?? state.timePresets,
            complexity: data.parsed.complexity ?? state.complexity,
            llmParsed: data.parsed,
          };
          // Build URL params from merged state
          const params = new URLSearchParams();
          if (merged.gameTypes.length > 0) params.set('types', merged.gameTypes.join(','));
          params.set('minPlayers', String(merged.playerCount.min));
          params.set('maxPlayers', String(merged.playerCount.max));
          if (merged.timePresets.length > 0) params.set('time', merged.timePresets.join(','));
          params.set('minComplexity', String(merged.complexity.min));
          params.set('maxComplexity', String(merged.complexity.max));
          if (data.parsed.genres?.length > 0) params.set('genres', data.parsed.genres.join(','));
          if (data.parsed.moods?.length > 0) params.set('moods', data.parsed.moods.join(','));
          params.set('freeText', state.freeText.trim());
          params.set('llmParsed', encodeURIComponent(JSON.stringify(data.parsed)));

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
      await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), preferences: state }),
      });
    } catch { /* silently fail if not logged in */ }
    setSaveDialogOpen(false);
    setPresetName('');
  }

  function submit() {
    saveGuestPreferences(state as unknown as Record<string, unknown>);

    const params = new URLSearchParams();

    if (state.gameTypes.length > 0) params.set('types', state.gameTypes.join(','));
    params.set('minPlayers', String(state.playerCount.min));
    params.set('maxPlayers', String(state.playerCount.max));
    if (state.timePresets.length > 0) params.set('time', state.timePresets.join(','));
    params.set('minComplexity', String(state.complexity.min));
    params.set('maxComplexity', String(state.complexity.max));
    if (state.genres.length > 0) params.set('genres', state.genres.join(','));
    if (state.moods.length > 0) params.set('moods', state.moods.join(','));
    if (state.freeText.trim()) params.set('freeText', state.freeText.trim());

    // Pass LLM-parsed data as a URL param so the recommend API can use it
    if (state.llmParsed) {
      params.set('llmParsed', encodeURIComponent(JSON.stringify(state.llmParsed)));
    }

    router.push(`/results?${params.toString()}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <FreeTextStep
            value={state.freeText}
            onChange={(v) => update({ freeText: v })}
            onQuickSubmit={quickSubmit}
            onCustomize={next}
            isParsing={isParsing}
          />
        );
      case 1:
        return <GameTypeStep value={state.gameTypes} onChange={(v) => update({ gameTypes: v })} />;
      case 2:
        return <PlayerCountStep value={state.playerCount} onChange={(v) => update({ playerCount: v })} />;
      case 3:
        return <TimeStep value={state.timePresets} onChange={(v) => update({ timePresets: v })} />;
      case 4:
        return <ComplexityStep value={state.complexity} onChange={(v) => update({ complexity: v })} />;
      case 5:
        return <GenreStep value={state.genres} onChange={(v) => update({ genres: v })} filteredGenres={getFilteredGenres(state)} />;
      case 6: {
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
      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 3, pb: 12 }}>
        {/* Progress */}
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 6 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
            {step + 1} of {totalSteps}
          </Typography>
        </Box>

        {/* Step Title + Content with slide animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
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
