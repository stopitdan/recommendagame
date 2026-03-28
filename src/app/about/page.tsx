import { Metadata } from 'next';
import AboutView from './AboutView';

export const metadata: Metadata = {
  title: 'About | boredgame.lol',
  description: 'Learn how boredgame.lol works — our recommendation engine, data sources, and tech stack.',
};

export default function AboutPage() {
  return <AboutView />;
}
