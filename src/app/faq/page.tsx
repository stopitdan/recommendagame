import { Metadata } from 'next';
import FAQView from './FAQView';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Recommend a Game — how recommendations work, data privacy, and more.',
};

export default function FAQPage() {
  return <FAQView />;
}
