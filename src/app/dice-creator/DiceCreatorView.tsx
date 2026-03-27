'use client';

import { useReducer, useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { CustomDiceSkinConfig } from '@/types/custom-dice';
import { SHADER_KEYS, SHADER_DEFAULTS } from '@/lib/dice-shaders';
import { DICE_SKINS, type DiceSkin } from '@/lib/dice-skins';
import { resolveCustomSkin, validateSkinConfig } from '@/lib/custom-dice-utils';
import { createClient } from '@/lib/supabase/client';

const PhysicsDice = dynamic(() => import('@/components/PhysicsDice'), {
  ssr: false,
  loading: () => (
    <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={32} sx={{ color: 'primary.main' }} />
    </Box>
  ),
});

// ─── State management ────────────────────────────────────────────

interface CreatorState {
  name: string;
  emoji: string;
  config: CustomDiceSkinConfig;
  isPublic: boolean;
  /** Existing skin ID when editing */
  editId: string | null;
}

type CreatorAction =
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_EMOJI'; emoji: string }
  | { type: 'SET_PUBLIC'; isPublic: boolean }
  | { type: 'SET_EDIT_ID'; editId: string }
  | { type: 'UPDATE_CONFIG'; patch: Partial<CustomDiceSkinConfig> }
  | { type: 'LOAD_STATE'; state: CreatorState };

const DEFAULT_CONFIG: CustomDiceSkinConfig = {
  baseType: 'solid',
  body: '#5B4FDB',
  accent: '#FF6D3F',
  metalness: 0.3,
  roughness: 0.4,
  labelStyle: 'numbers',
  label: '#FFFFFF',
  labelShadow: 'rgba(0,0,0,0.5)',
};

function reducer(state: CreatorState, action: CreatorAction): CreatorState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.name.slice(0, 50) };
    case 'SET_EMOJI':
      return { ...state, emoji: action.emoji };
    case 'SET_PUBLIC':
      return { ...state, isPublic: action.isPublic };
    case 'SET_EDIT_ID':
      return { ...state, editId: action.editId };
    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.patch } };
    case 'LOAD_STATE':
      return action.state;
    default:
      return state;
  }
}

const INITIAL_STATE: CreatorState = {
  name: '',
  emoji: '🎲',
  config: DEFAULT_CONFIG,
  isPublic: false,
  editId: null,
};

// ─── Common emoji grid ──────────────────────────────────────────

const EMOJI_OPTIONS = [
  '🎲', '🎮', '🎯', '🔥', '💎', '⚡', '🌊', '🌌', '🌈', '☢️',
  '🏛️', '🌋', '❄️', '🪩', '🌑', '😄', '👻', '🐉', '💀', '🎃',
  '🤖', '🦄', '🧙', '🪄', '⭐', '🌟', '💫', '🎪', '🎭', '🎨',
  '🏆', '👑', '💰', '🗡️', '🛡️', '🏹', '⚔️', '🔮', '📿', '🧿',
];

// ─── Shader swatch grid ─────────────────────────────────────────

function ShaderSwatchGrid({ selected, onSelect }: {
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
      {SHADER_KEYS.map((key) => {
        const defaults = SHADER_DEFAULTS[key];
        const isActive = selected === key;
        return (
          <Tooltip key={key} title={key.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
            <Box
              onClick={() => onSelect(key)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${defaults.color1}, ${defaults.color2})`,
                border: isActive ? '2.5px solid' : '2px solid transparent',
                borderColor: isActive ? 'primary.main' : 'transparent',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                '&:hover': { transform: 'scale(1.15)' },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

// ─── Color picker helper ────────────────────────────────────────

function ColorPicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }}>{label}</Typography>
      <input
        type="color"
        value={value.startsWith('#') ? value.slice(0, 7) : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          padding: 0,
          background: 'transparent',
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function DiceCreatorView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Load existing skin if ?id=xxx is present
  useEffect(() => {
    const editId = searchParams.get('id');
    if (!editId) return;

    async function loadSkin() {
      try {
        const res = await fetch(`/api/dice-skins/${editId}`);
        if (!res.ok) return;
        const { skin } = await res.json();
        dispatch({
          type: 'LOAD_STATE',
          state: {
            name: skin.name,
            emoji: skin.emoji,
            config: skin.config,
            isPublic: skin.is_public,
            editId: skin.id,
          },
        });
      } catch {
        // Failed to load — start fresh
      }
    }
    loadSkin();
  }, [searchParams]);

  // Build a live preview DiceSkin from current state
  const previewSkin = useMemo(
    () => resolveCustomSkin(
      state.editId ?? 'preview',
      state.name || 'Preview',
      state.emoji,
      state.config,
    ),
    [state.editId, state.name, state.emoji, state.config],
  );

  const handleSave = useCallback(async () => {
    if (!state.name.trim()) {
      setSnackbar({ message: 'Please enter a name for your dice', severity: 'error' });
      return;
    }
    const errors = validateSkinConfig(state.config);
    if (errors.length > 0) {
      setSnackbar({ message: errors[0], severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSnackbar({ message: 'Please sign in to save dice skins', severity: 'error' });
        setSaving(false);
        return;
      }

      const body = {
        name: state.name.trim(),
        emoji: state.emoji,
        config: state.config,
        is_public: state.isPublic,
      };

      const url = state.editId ? `/api/dice-skins/${state.editId}` : '/api/dice-skins';
      const method = state.editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setSnackbar({ message: state.editId ? 'Dice skin updated!' : 'Dice skin created!', severity: 'success' });

      // If new, redirect to edit mode
      if (!state.editId && data.id) {
        dispatch({ type: 'SET_EDIT_ID', editId: data.id });
      }
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Failed to save', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [state]);

  const updateConfig = useCallback((patch: Partial<CustomDiceSkinConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', patch });
  }, []);

  // "Start from existing" handler
  function handleForkSkin(skinId: string) {
    const skin = DICE_SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    updateConfig({
      baseType: skin.type === 'shader' ? 'shader' : 'solid',
      body: skin.body,
      accent: skin.accent,
      label: skin.label,
      labelShadow: skin.labelShadow,
      metalness: skin.metalness,
      roughness: skin.roughness,
      shaderKey: skin.shaderKey,
      labelStyle: skin.type === 'emoji' ? 'emoji' : 'numbers',
    });
  }

  const { config } = state;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
        Dice Creator
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Design your own custom d20 — pick colors, shaders, images, and more.
      </Typography>

      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
      }}>
        {/* ── Editor (left on desktop, bottom on mobile) ── */}
        <Box sx={{ flex: { md: '0 0 55%' }, order: { xs: 2, md: 1 } }}>
          <Stack spacing={0}>
            {/* Section 1: Identity */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Identity</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="Dice Name"
                    value={state.name}
                    onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
                    inputProps={{ maxLength: 50 }}
                    helperText={`${state.name.length}/50`}
                    fullWidth
                    size="small"
                  />
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>Emoji</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {EMOJI_OPTIONS.map((e) => (
                        <Box
                          key={e}
                          onClick={() => dispatch({ type: 'SET_EMOJI', emoji: e })}
                          sx={{
                            width: 34,
                            height: 34,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: state.emoji === e ? '2px solid' : '2px solid transparent',
                            borderColor: state.emoji === e ? 'primary.main' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          {e}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Section 2: Base Layer */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Base Layer</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    value={config.baseType}
                    exclusive
                    onChange={(_, val) => val && updateConfig({ baseType: val })}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="solid">Solid Color</ToggleButton>
                    <ToggleButton value="shader">Shader Effect</ToggleButton>
                    <ToggleButton value="image">Image/Photo</ToggleButton>
                  </ToggleButtonGroup>

                  <ColorPicker
                    label="Body Color"
                    value={config.body}
                    onChange={(hex) => updateConfig({ body: hex })}
                  />

                  {config.baseType === 'shader' && (
                    <>
                      <Typography variant="body2" fontWeight={600}>Choose Shader</Typography>
                      <ShaderSwatchGrid
                        selected={config.shaderKey}
                        onSelect={(key) => {
                          const defaults = SHADER_DEFAULTS[key];
                          updateConfig({
                            shaderKey: key,
                            shaderColors: defaults ? { ...defaults } : undefined,
                          });
                        }}
                      />
                      {config.shaderKey && config.shaderColors && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Customize shader colors
                          </Typography>
                          <Stack spacing={1}>
                            <ColorPicker
                              label="Color 1"
                              value={config.shaderColors.color1}
                              onChange={(hex) => updateConfig({
                                shaderColors: { ...config.shaderColors!, color1: hex },
                              })}
                            />
                            <ColorPicker
                              label="Color 2"
                              value={config.shaderColors.color2}
                              onChange={(hex) => updateConfig({
                                shaderColors: { ...config.shaderColors!, color2: hex },
                              })}
                            />
                            <ColorPicker
                              label="Color 3"
                              value={config.shaderColors.color3}
                              onChange={(hex) => updateConfig({
                                shaderColors: { ...config.shaderColors!, color3: hex },
                              })}
                            />
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => {
                                const defaults = SHADER_DEFAULTS[config.shaderKey!];
                                if (defaults) updateConfig({ shaderColors: { ...defaults } });
                              }}
                            >
                              Reset to defaults
                            </Button>
                          </Stack>
                        </Box>
                      )}
                    </>
                  )}

                  {config.baseType === 'image' && (
                    <>
                      <ToggleButtonGroup
                        value={config.imageMode ?? 'wrap'}
                        exclusive
                        onChange={(_, val) => val && updateConfig({ imageMode: val })}
                        size="small"
                        fullWidth
                      >
                        <ToggleButton value="wrap">Wrap</ToggleButton>
                        <ToggleButton value="tile">Tile</ToggleButton>
                        <ToggleButton value="per-face">Per-Face</ToggleButton>
                      </ToggleButtonGroup>
                      <Typography variant="caption" color="text.secondary">
                        Image upload coming soon — for now, use a direct image URL.
                      </Typography>
                      <TextField
                        label="Image URL"
                        value={config.wrapImageUrl ?? ''}
                        onChange={(e) => updateConfig({ wrapImageUrl: e.target.value })}
                        fullWidth
                        size="small"
                        placeholder="https://example.com/image.png"
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Section 3: Overlay Effect */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Overlay Effect</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mt: 0.3 }}>
                  Optional
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!config.overlayShaderKey}
                        onChange={(_, checked) => {
                          if (checked) {
                            updateConfig({ overlayShaderKey: 'fire', overlayOpacity: 0.5 });
                          } else {
                            updateConfig({ overlayShaderKey: undefined, overlayOpacity: undefined });
                          }
                        }}
                      />
                    }
                    label="Add shader overlay"
                  />
                  {config.overlayShaderKey && (
                    <>
                      <ShaderSwatchGrid
                        selected={config.overlayShaderKey}
                        onSelect={(key) => updateConfig({ overlayShaderKey: key })}
                      />
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Opacity: {Math.round((config.overlayOpacity ?? 0.5) * 100)}%
                        </Typography>
                        <Slider
                          value={config.overlayOpacity ?? 0.5}
                          onChange={(_, val) => updateConfig({ overlayOpacity: val as number })}
                          min={0}
                          max={1}
                          step={0.05}
                          size="small"
                        />
                      </Box>
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Section 4: Material & Lighting */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Material & Lighting</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Metalness</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Matte ↔ Metallic
                      </Typography>
                    </Box>
                    <Slider
                      value={config.metalness}
                      onChange={(_, val) => updateConfig({ metalness: val as number })}
                      min={0}
                      max={1}
                      step={0.05}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Roughness</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Glossy ↔ Rough
                      </Typography>
                    </Box>
                    <Slider
                      value={config.roughness}
                      onChange={(_, val) => updateConfig({ roughness: val as number })}
                      min={0}
                      max={1}
                      step={0.05}
                      size="small"
                    />
                  </Box>
                  <ColorPicker
                    label="Accent Light"
                    value={config.accent}
                    onChange={(hex) => updateConfig({ accent: hex })}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Section 5: Labels */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Labels</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    value={config.labelStyle}
                    exclusive
                    onChange={(_, val) => val && updateConfig({ labelStyle: val })}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="numbers">Numbers</ToggleButton>
                    <ToggleButton value="emoji">Emoji</ToggleButton>
                    <ToggleButton value="hidden">Hidden</ToggleButton>
                  </ToggleButtonGroup>

                  {config.labelStyle === 'numbers' && (
                    <>
                      <ColorPicker
                        label="Label Color"
                        value={config.label}
                        onChange={(hex) => updateConfig({ label: hex })}
                      />
                      <ColorPicker
                        label="Shadow Color"
                        value={config.labelShadow}
                        onChange={(hex) => updateConfig({ labelShadow: hex })}
                      />
                    </>
                  )}

                  {config.labelStyle === 'emoji' && (
                    <TextField
                      select
                      label="Emoji Set"
                      value={config.emojiSet ?? 'mood'}
                      onChange={(e) => updateConfig({ emojiSet: e.target.value as 'mood' | 'spooky' })}
                      size="small"
                      fullWidth
                    >
                      <MenuItem value="mood">Mood (😢 → 🥳)</MenuItem>
                      <MenuItem value="spooky">Spooky (💀 → 🪄)</MenuItem>
                    </TextField>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Section 6: Save & Share */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography fontWeight={600}>Save & Share</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={state.isPublic}
                        onChange={(_, checked) => dispatch({ type: 'SET_PUBLIC', isPublic: checked })}
                      />
                    }
                    label="Make public"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                    Public skins appear in the Dice Gallery for others to use and vote on.
                  </Typography>

                  <TextField
                    select
                    label="Start from existing"
                    value=""
                    onChange={(e) => handleForkSkin(e.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="" disabled>Choose a preset...</MenuItem>
                    {DICE_SKINS.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.emoji} {s.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSave}
                    disabled={saving || !state.name.trim()}
                    sx={{ py: 1.5 }}
                  >
                    {saving ? (
                      <CircularProgress size={20} sx={{ color: 'inherit', mr: 1 }} />
                    ) : null}
                    {state.editId ? 'Update Dice Skin' : 'Save Dice Skin'}
                  </Button>

                  <Button
                    variant="text"
                    onClick={() => router.push('/random')}
                    sx={{ color: 'text.secondary' }}
                  >
                    Back to Dice Roller
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Box>

        {/* ── Live 3D Preview (right on desktop, top on mobile) ── */}
        <Box sx={{
          flex: { md: '0 0 45%' },
          order: { xs: 1, md: 2 },
          position: { md: 'sticky' },
          top: { md: 80 },
          alignSelf: { md: 'flex-start' },
        }}>
          <Box sx={{
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}>
            <PhysicsDice
              rolling={false}
              onSettled={() => {}}
              skin={previewSkin}
            />
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={700}>
                {state.emoji} {state.name || 'Untitled Dice'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click the die to spin it
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Snackbar for save feedback */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  );
}

// ─── Expand icon for accordions ──────────────────────────────────

function ExpandIcon() {
  return (
    <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>
      ▼
    </Typography>
  );
}
