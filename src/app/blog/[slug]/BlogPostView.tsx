'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { ArrowLeft } from 'lucide-react';
import JsonLd from '@/components/JsonLd';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  tags: string[];
  published_at: string;
}

/** Simple markdown-to-HTML for blog content (handles headers, links, bold, lists) */
function renderMarkdown(md: string): string {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: inherit; text-decoration: underline;">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-3]>)/g, '$1')
    .replace(/(<\/h[1-3]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
}

export default function BlogPostView() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/blog/${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.post) setPost(data.post); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'secondary.main' }} />
      </Box>
    );
  }

  if (!post) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
          Post not found
        </Typography>
        <Button variant="contained" onClick={() => router.push('/blog')}>
          Back to Blog
        </Button>
      </Container>
    );
  }

  const publishedDate = new Date(post.published_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.published_at,
        url: `https://boredgame.lol/blog/${post.slug}`,
        publisher: {
          '@type': 'Organization',
          name: 'boredgame.lol',
          url: 'https://boredgame.lol',
        },
      }} />

      <Button
        variant="text"
        onClick={() => router.push('/blog')}
        startIcon={<ArrowLeft size={16} />}
        sx={{ mb: 3 }}
      >
        All Posts
      </Button>

      <Typography variant="h3" fontWeight={800} sx={{ mb: 1, lineHeight: 1.2 }}>
        {post.title}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {publishedDate}
        </Typography>
        {post.tags.map((tag) => (
          <Chip key={tag} label={tag} size="small" variant="outlined" />
        ))}
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Box
        sx={{
          '& h2': { fontSize: '1.5rem', fontWeight: 700, mt: 4, mb: 1.5 },
          '& h3': { fontSize: '1.25rem', fontWeight: 700, mt: 3, mb: 1 },
          '& p': { lineHeight: 1.8, mb: 2, color: 'text.secondary' },
          '& a': { color: 'primary.main', textDecoration: 'underline' },
          '& ul': { pl: 3, mb: 2 },
          '& li': { lineHeight: 1.8, color: 'text.secondary', mb: 0.5 },
          '& strong': { color: 'text.primary' },
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />

      <Divider sx={{ my: 4 }} />

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Ready to find your next game?
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => router.push('/find-a-game')}
          sx={{ fontWeight: 700, borderRadius: 3, px: 4 }}
        >
          Get Recommendations
        </Button>
      </Box>
    </Container>
  );
}
