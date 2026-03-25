'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface Review {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
  user_profiles?: { display_name: string | null };
}

export interface ReviewListProps {
  gameId: string;
  refreshKey?: number;
}

export default function ReviewList({ gameId, refreshKey }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reviews?gameId=${encodeURIComponent(gameId)}`);
        if (!res.ok) return;
        const data = await res.json();
        setReviews(data.reviews ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [gameId, refreshKey]);

  if (loading) return null;

  if (reviews.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No reviews yet. Be the first!
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {reviews.map((review) => (
        <Box
          key={review.id}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {review.user_profiles?.display_name || 'Anonymous'}
            </Typography>
            <Rating
              value={review.rating / 2}
              readOnly
              size="small"
              precision={0.5}
              sx={{ '& .MuiRating-iconFilled': { color: 'secondary.main' } }}
            />
          </Box>
          {review.review_text && (
            <Typography variant="body2">
              {review.review_text}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {new Date(review.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
