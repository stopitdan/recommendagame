import { Metadata } from 'next';
import SettingsView from './SettingsView';

export const metadata: Metadata = {
  title: 'Settings | Recommend a Game',
  description: 'Customize your recommendation preferences.',
};

export default function SettingsPage() {
  return <SettingsView />;
}
