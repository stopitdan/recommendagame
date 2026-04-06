'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BookOpen } from 'lucide-react';
import JsonLd from '@/components/JsonLd';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  published_at: string;
}

export default function BlogListView() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog?limit=50')
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'boredgame.lol Blog',
        description: 'Game guides, recommendations, and tips to help you find something great to play.',
        url: 'https://boredgame.lol/blog',
        publisher: { '@type': 'Organization', name: 'boredgame.lol', url: 'https://boredgame.lol' },
      }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <BookOpen size={28} />
        <Typography variant="h3" fontWeight={800}>
          Blog
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Game guides, recommendations, and tips to help you find something great to play.
      </Typography>

      {loading ? (
        <Stack spacing={2}>
          {[...Array(3)].map((_, i) => (
            <Card key={i} variant="outlined" sx={{ p: 3, opacity: 0.5 }}>
              <Box sx={{ height: 20, width: '60%', bgcolor: 'action.hover', borderRadius: 1, mb: 1 }} />
              <Box sx={{ height: 14, width: '90%', bgcolor: 'action.hover', borderRadius: 1 }} />
            </Card>
          ))}
        </Stack>
      ) : posts.length === 0 ? (
        <Card variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No posts yet. Check back soon!
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {posts.map((post) => (
            <Card
              key={post.id}
              variant="outlined"
              sx={{
                transition: 'all 200ms',
                '&:hover': { borderColor: 'primary.main', boxShadow: (t) => `0 4px 16px ${t.palette.primary.main}10` },
              }}
            >
              <CardActionArea onClick={() => router.push(`/blog/${post.slug}`)} sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                  {post.title}
                </Typography>
                {post.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                    {post.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </Typography>
                  {post.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
