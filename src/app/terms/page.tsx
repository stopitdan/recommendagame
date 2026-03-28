import { Metadata } from 'next';
import TermsView from './TermsView';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Recommend a Game — rules and guidelines for using our platform.',
};

export default function TermsPage() {
  return <TermsView />;
}
