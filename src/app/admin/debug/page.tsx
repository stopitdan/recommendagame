'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { createClient } from '@/lib/supabase/client';

interface DebugResult {
  id: string;
  name: string;
  _score: number;
  _breakdown: Record<string, number>;
  _reasons: string[];
  categories: string[];
  mechanics: string[];
  themes: string[];
  types: string[];
  rating: number | null;
  ratingCount: number | null;
  playerCount?: { min: number; max: number };
  playTime?: { min: number; max: number; average?: number };
  complexity?: number;
  enrichedMetadata?: {
    moods?: string[];
    vibeKeywords?: string[];
    targetAudience?: string[];
    similarGames?: string[];
    refinedMechanics?: string[];
  };
}

interface LLMParsed {
  gameTypes: string[];
  genres: string[];
  mechanics: string[];
  moods: string[];
  keywords: string[];
  similarTo: string[];
  designers: string[];
  maxMinutes: number | null;
  timeStrictness: string | null;
  timePresets: string[];
  complexity: { min: number; max: number } | null;
  playerCount: { min: number; max: number } | null;
  excludedGenres: string[];
  excludedMechanics: string[];
  intentModifiers?: {
    mustHave?: string[];
    niceToHave?: string[];
    avoid?: string[];
    emphasize?: string[];
  };
}

interface DebugResponse {
  llmParsed: LLMParsed | null;
  requestBody: Record<string, unknown>;
  results: DebugResult[];
  totalCandidates: number;
  engine: string;
  latencyMs: number;
}

const BREAKDOWN_KEYS = [
  'genreMatch',
  'freeTextMatch',
  'playerCountFit',
  'timeFit',
  'complexityFit',
  'typeMatch',
  'moodAlignment',
  'qualitySignal',
  'popularitySignal',
  'recencyBoost',
] as const;

const BREAKDOWN_SHORT: Record<string, string> = {
  genreMatch: 'Genre',
  freeTextMatch: 'FreeText',
  playerCountFit: 'Players',
  timeFit: 'Time',
  complexityFit: 'Complex',
  typeMatch: 'Type',
  moodAlignment: 'Mood',
  qualitySignal: 'Quality',
  popularitySignal: 'Pop',
  recencyBoost: 'Recent',
};

function scoreColor(score: number): string {
  if (score >= 0.8) return '#4caf50';
  if (score >= 0.5) return '#ff9800';
  if (score > 0) return '#f44336';
  return '#666';
}

export default function AdminDebugPage() {
  const [freeText, setFreeText] = useState('');
  const [playerCount, setPlayerCount] = useState<[number, number]>([1, 10]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DebugResponse | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Check auth on mount
  useState(() => {
    createClient().auth.getUser().then(({ data: d }) => {
      setAuthed(d.user?.email === 'danjwiegand@gmail.com');
    });
  });

  const runDebug = useCallback(async () => {
    if (!freeText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Call the SAME endpoint as the real product — same codepath, same results
      const recBody = {
        freeText,
        gameTypes: [],
        playerCount: { min: playerCount[0], max: playerCount[1] },
        timePresets: [],
        complexity: { min: 1, max: 5 },
        genres: [],
        moods: [],
        limit: 50,
        _nocache: true,
      };

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recBody),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const recData = await res.json();

      setData({
        llmParsed: recData._debug?.llmParsed ?? null,
        requestBody: {
          ...recBody,
          genres: recData._debug?.mergedGenres ?? [],
          gameTypes: recData._debug?.mergedGameTypes ?? [],
        },
        results: recData.results ?? [],
        totalCandidates: recData.totalCandidates,
        engine: recData.engine,
        latencyMs: recData.latencyMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [freeText, playerCount]);

  if (authed === false) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h5" color="error">Admin access required</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Sign in with danjwiegand@gmail.com
        </Typography>
      </Container>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    }}>
      <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'inherit' }}>
            Rec Engine Debug
          </Typography>
          <Chip label="ADMIN" size="small" color="error" />
        </Stack>

        {/* Input controls */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Free text query"
              placeholder='e.g. "a fun anime themed board game for 4 players, takes around an hour to play"'
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runDebug()}
              size="small"
              sx={{ '& input': { fontFamily: 'inherit' } }}
            />
            <Stack direction="row" spacing={3} alignItems="center">
              <Typography variant="body2" sx={{ minWidth: 80 }}>Players:</Typography>
              <Slider
                value={playerCount}
                onChange={(_, v) => setPlayerCount(v as [number, number])}
                min={1}
                max={10}
                valueLabelDisplay="auto"
                sx={{ maxWidth: 300 }}
              />
              <Typography variant="body2" sx={{ minWidth: 50 }}>
                {playerCount[0]}-{playerCount[1]}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                onClick={runDebug}
                disabled={loading || !freeText.trim()}
                sx={{ fontFamily: 'inherit', minWidth: 120 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Run Query'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {error && (
          <Typography color="error" sx={{ mb: 2, fontFamily: 'inherit' }}>
            {error}
          </Typography>
        )}

        {data && (
          <>
            {/* LLM Parse Results */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'inherit', fontWeight: 700 }}>
                LLM Parsed Preferences
              </Typography>
              {data.llmParsed ? (
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 1.5,
                  fontSize: '0.8rem',
                }}>
                  <ParsedField label="Game Types" values={data.llmParsed.gameTypes} />
                  <ParsedField label="Genres" values={data.llmParsed.genres} color="primary" />
                  <ParsedField label="Mechanics" values={data.llmParsed.mechanics} color="secondary" />
                  <ParsedField label="Moods" values={data.llmParsed.moods} />
                  <ParsedField label="Keywords" values={data.llmParsed.keywords} />
                  <ParsedField label="Similar To" values={data.llmParsed.similarTo} />
                  <ParsedField label="Designers" values={data.llmParsed.designers} />
                  <ParsedField label="Excluded Genres" values={data.llmParsed.excludedGenres} color="error" />
                  <ParsedField label="Excluded Mechanics" values={data.llmParsed.excludedMechanics} color="error" />
                  {data.llmParsed.maxMinutes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Max Minutes</Typography>
                      <Typography variant="body2">{data.llmParsed.maxMinutes} ({data.llmParsed.timeStrictness ?? 'none'})</Typography>
                    </Box>
                  )}
                  {data.llmParsed.complexity && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Complexity</Typography>
                      <Typography variant="body2">{data.llmParsed.complexity.min}-{data.llmParsed.complexity.max}</Typography>
                    </Box>
                  )}
                  {data.llmParsed.playerCount && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Player Count</Typography>
                      <Typography variant="body2">{data.llmParsed.playerCount.min}-{data.llmParsed.playerCount.max}</Typography>
                    </Box>
                  )}
                  {data.llmParsed.intentModifiers && (
                    <>
                      <ParsedField label="Must Have" values={data.llmParsed.intentModifiers.mustHave ?? []} color="success" />
                      <ParsedField label="Nice to Have" values={data.llmParsed.intentModifiers.niceToHave ?? []} />
                      <ParsedField label="Avoid" values={data.llmParsed.intentModifiers.avoid ?? []} color="error" />
                      <ParsedField label="Emphasize" values={data.llmParsed.intentModifiers.emphasize ?? []} color="warning" />
                    </>
                  )}
                </Box>
              ) : (
                <Typography color="error" variant="body2">LLM parsing failed or returned null</Typography>
              )}
            </Paper>

            {/* Engine metadata */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Chip label={`Engine: ${data.engine}`} size="small" variant="outlined" />
              <Chip label={`${data.totalCandidates} candidates`} size="small" variant="outlined" />
              <Chip label={`${data.results.length} results`} size="small" variant="outlined" />
              <Chip label={`${data.latencyMs}ms`} size="small" variant="outlined" />
              {Array.isArray(data.requestBody.genres) && data.requestBody.genres.length > 0 && (
                <Chip
                  label={`Merged genres: ${(data.requestBody.genres as string[]).join(', ')}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Stack>

            {/* Results table */}
            <TableContainer component={Paper} sx={{ overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 30 }}>#</TableCell>
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 200 }}>Game</TableCell>
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 60 }} align="right">Score</TableCell>
                    {BREAKDOWN_KEYS.map((k) => (
                      <TableCell key={k} sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '0.7rem', minWidth: 50 }} align="center">
                        {BREAKDOWN_SHORT[k]}
                      </TableCell>
                    ))}
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 200 }}>Tags</TableCell>
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 150 }}>Enriched</TableCell>
                    <TableCell sx={{ fontFamily: 'inherit', fontWeight: 700, minWidth: 60 }}>Info</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.results.map((game, i) => (
                    <TableRow
                      key={game.id}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        bgcolor: i < 3 ? 'action.selected' : undefined,
                      }}
                    >
                      <TableCell sx={{ fontFamily: 'inherit', fontSize: '0.75rem' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {game.name}
                        </Typography>
                        {game._reasons?.slice(0, 1).map((r, j) => (
                          <Typography key={j} variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            {r}
                          </Typography>
                        ))}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            color: scoreColor(game._score),
                            fontSize: '0.85rem',
                          }}
                        >
                          {(game._score * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      {BREAKDOWN_KEYS.map((k) => {
                        const v = game._breakdown?.[k] ?? 0;
                        return (
                          <TableCell key={k} align="center" sx={{ p: 0.5 }}>
                            <Box sx={{
                              fontFamily: 'inherit',
                              fontSize: '0.7rem',
                              fontWeight: v > 0.5 ? 700 : 400,
                              color: scoreColor(v),
                              bgcolor: v === 0 ? 'error.main' : undefined,
                              borderRadius: v === 0 ? 0.5 : undefined,
                              px: v === 0 ? 0.5 : undefined,
                              opacity: v === 0 ? 0.3 : 1,
                            }}>
                              {v === 0 ? '0' : v.toFixed(2)}
                            </Box>
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <Stack direction="row" flexWrap="wrap" gap={0.3}>
                          {[...game.categories.slice(0, 3), ...game.themes.slice(0, 2)].map((t) => (
                            <Chip key={t} label={t} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                          ))}
                          {game.mechanics.slice(0, 2).map((m) => (
                            <Chip key={m} label={m} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {game.enrichedMetadata ? (
                          <Stack direction="row" flexWrap="wrap" gap={0.3}>
                            {(game.enrichedMetadata.moods ?? []).map((m) => (
                              <Chip key={m} label={m} size="small" color="info" sx={{ fontSize: '0.6rem', height: 18 }} />
                            ))}
                            {(game.enrichedMetadata.vibeKeywords ?? []).slice(0, 3).map((v) => (
                              <Chip key={v} label={v} size="small" color="secondary" sx={{ fontSize: '0.6rem', height: 18 }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.disabled">none</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'inherit', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                          {game.rating?.toFixed(1) ?? '?'} ({game.ratingCount ? `${(game.ratingCount / 1000).toFixed(0)}k` : '?'})
                          <br />
                          {game.playerCount ? `${game.playerCount.min}-${game.playerCount.max}p` : '?p'}
                          {' '}
                          {game.playTime?.average ? `${game.playTime.average}m` : '?m'}
                          {' '}
                          {game.complexity ? `w${game.complexity.toFixed(1)}` : ''}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Container>
    </Box>
  );
}

function ParsedField({ label, values, color }: { label: string; values: string[]; color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info' }) {
  if (values.length === 0) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.3 }}>
        {values.map((v) => (
          <Chip key={v} label={v} size="small" color={color ?? 'default'} sx={{ fontSize: '0.7rem', height: 20 }} />
        ))}
      </Stack>
    </Box>
  );
}
