import { Metadata } from 'next';
import PrivacyView from './PrivacyView';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for boredgame.lol — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
