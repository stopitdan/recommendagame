import { Metadata } from 'next';
import ContactView from './ContactView';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the boredgame.lol team — report issues, ask questions, or share feedback.',
};

export default function ContactPage() {
  return <ContactView />;
}
