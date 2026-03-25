'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

export interface ReviewFormProps {
  gameId: string;
  onSubmit?: () => void;
}

export default function ReviewForm({ gameId, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          rating: rating * 2, // Convert 5-star to 1-10 scale
          reviewText: reviewText.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        setError('Log in to leave a review');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit review');
        return;
      }

      setSuccess(true);
      onSubmit?.();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Leave a Review
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>Review submitted!</Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Stack spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Your rating
          </Typography>
          <Rating
            value={rating}
            onChange={(_, value) => setRating(value)}
            size="large"
            sx={{
              '& .MuiRating-iconFilled': { color: 'secondary.main' },
              '& .MuiRating-iconHover': { color: 'secondary.dark' },
            }}
          />
        </Box>

        <TextField
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          multiline
          rows={3}
          fullWidth
          placeholder="What did you think? (optional)"
          variant="outlined"
        />

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!rating || submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </Stack>
    </Box>
  );
}
