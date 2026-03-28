import { Metadata } from 'next';
import BlogListView from './BlogListView';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Game guides, recommendations, and tips from boredgame.lol. Find your next favorite game.',
};

export default function BlogPage() {
  return <BlogListView />;
}
