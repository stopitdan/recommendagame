'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { INITIAL_STATE } from '@/types/questionnaire';
import GameTypeStep from '@/components/questionnaire/GameTypeStep';
import PlayerCountStep from '@/components/questionnaire/PlayerCountStep';
import TimeStep from '@/components/questionnaire/TimeStep';
import ComplexityStep from '@/components/questionnaire/ComplexityStep';
import GenreStep from '@/components/questionnaire/GenreStep';
import MoodStep from '@/components/questionnaire/MoodStep';
import FreeTextStep from '@/components/questionnaire/FreeTextStep';

const STEPS = [
  { key: 'gameType', title: 'What kind of game?' },
  { key: 'playerCount', title: 'How many players?' },
  { key: 'timeAvailable', title: 'How much time do you have?' },
  { key: 'complexity', title: 'How complex?' },
  { key: 'genres', title: 'Pick genres you like' },
  { key: 'moods', title: "What's the vibe?" },
  { key: 'freeText', title: 'Anything else?' },
] as const;

export default function QuestionnaireFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuestionnaireState>(INITIAL_STATE);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const isLast = step === totalSteps - 1;

  function update(partial: Partial<QuestionnaireState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function next() {
    if (isLast) {
      submit();
    } else {
      setStep((s) => s + 1);
    }
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
    // Build query params from state and navigate to results
    const params = new URLSearchParams();

    if (state.gameType) params.set('type', state.gameType);
    params.set('minPlayers', String(state.playerCount.min));
    params.set('maxPlayers', String(state.playerCount.max));
    if (state.timeAvailable) params.set('time', state.timeAvailable);
    params.set('minComplexity', String(state.complexity.min));
    params.set('maxComplexity', String(state.complexity.max));
    if (state.genres.length > 0) params.set('genres', state.genres.join(','));
    if (state.moods.length > 0) params.set('moods', state.moods.join(','));
    if (state.freeText.trim()) params.set('freeText', state.freeText.trim());

    router.push(`/results?${params.toString()}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return <GameTypeStep value={state.gameType} onChange={(v) => update({ gameType: v })} />;
      case 1:
        return <PlayerCountStep value={state.playerCount} onChange={(v) => update({ playerCount: v })} />;
      case 2:
        return <TimeStep value={state.timeAvailable} onChange={(v) => update({ timeAvailable: v })} />;
      case 3:
        return <ComplexityStep value={state.complexity} onChange={(v) => update({ complexity: v })} />;
      case 4:
        return <GenreStep value={state.genres} onChange={(v) => update({ genres: v })} />;
      case 5:
        return <MoodStep value={state.moods} onChange={(v) => update({ moods: v })} />;
      case 6:
        return <FreeTextStep value={state.freeText} onChange={(v) => update({ freeText: v })} />;
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

        {/* Step Title */}
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
          {STEPS[step].title}
        </Typography>

        {/* Step Content */}
        <Box>
          {renderStep()}
        </Box>
      </Container>

      {/* Sticky Navigation */}
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
            <Button variant="text" onClick={next} sx={{ minWidth: 80 }}>
              {isLast ? '' : 'Skip'}
            </Button>
            <Button variant="contained" onClick={next} sx={{ minWidth: 140 }}>
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
