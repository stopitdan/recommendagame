import { Metadata } from 'next';
import DiceSkinDetailView from './DiceSkinDetailView';

export const metadata: Metadata = {
  title: 'Dice Skin | boredgame.lol',
  description: 'View and use a custom d20 dice skin.',
};

export default function DiceSkinDetailPage() {
  return <DiceSkinDetailView />;
}
