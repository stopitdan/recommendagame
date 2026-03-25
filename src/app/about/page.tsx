import { Metadata } from 'next';
import AboutView from './AboutView';

export const metadata: Metadata = {
  title: 'About | Recommend a Game',
  description: 'Learn how Recommend a Game works — our recommendation engine, data sources, and tech stack.',
};

export default function AboutPage() {
  return <AboutView />;
}
