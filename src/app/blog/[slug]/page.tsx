import { Metadata } from 'next';
import BlogPostView from './BlogPostView';

export const metadata: Metadata = {
  title: 'Blog Post',
};

export default function BlogPostPage() {
  return <BlogPostView />;
}
