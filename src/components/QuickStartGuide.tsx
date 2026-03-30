'use client';

import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { ChevronDown, BookOpen, Sparkles } from 'lucide-react';

interface QuickStartGuideProps {
  gameId: string;
  gameName: string;
  /** Only show for games with enough metadata */
  hasDescription: boolean;
  mechanicCount: number;
}

/**
 * Collapsible "How to Play" section that lazy-loads an AI-generated summary.
 * Only generates when the user expands the accordion (saves API costs).
 */
export default function QuickStartGuide({ gameId, gameName, hasDescription, mechanicCount }: QuickStartGuideProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Don't render at all for games with insufficient metadata
  if (!hasDescription || mechanicCount < 1) return null;

  async function loadSummary() {
    if (summary || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/quickstart`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not generate summary');
        return;
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setError('Failed to load. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(_: unknown, isExpanded: boolean) {
    setExpanded(isExpanded);
    if (isExpanded && !summary && !loading) {
      loadSummary();
    }
  }

  return (
    <Accordion
      expanded={expanded}
      onChange={handleChange}
      variant="outlined"
      sx={{
        borderRadius: '12px !important',
        '&::before': { display: 'none' },
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={20} />}
        sx={{ px: 2.5 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookOpen size={18} />
          <Typography variant="subtitle1" fontWeight={700}>
            How to Play
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'action.hover',
              fontSize: '0.7rem',
              color: 'text.secondary',
            }}
          >
            <Sparkles size={12} />
            AI Summary
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pb: 3 }}>
        <Alert severity="info" variant="outlined" sx={{ mb: 2, fontSize: '0.8rem' }}>
          AI-generated summary based on {gameName}'s metadata. Always refer to the official rules for the full picture.
        </Alert>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {summary && (
          <Box
            sx={{
              '& h2': {
                fontSize: '1rem',
                fontWeight: 700,
                mt: 2,
                mb: 0.5,
                '&:first-of-type': { mt: 0 },
              },
              '& p': {
                fontSize: '0.9rem',
                lineHeight: 1.6,
                color: 'text.secondary',
                mb: 1,
              },
              '& ul, & ol': {
                fontSize: '0.9rem',
                color: 'text.secondary',
                pl: 2.5,
                mb: 1,
              },
              '& li': {
                mb: 0.5,
              },
            }}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/** Minimal markdown to HTML for the summary (headers, lists, paragraphs) */
function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, (line) => line ? `<p>${line}` : '')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hul])/g, '$1')
    .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}
