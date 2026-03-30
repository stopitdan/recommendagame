import type { Metadata } from 'next';
import ChatView from './ChatView';

export const metadata: Metadata = {
  title: 'Board Game Sommelier | boredgame.lol',
  description: 'Chat with our AI board game expert to find your perfect game. Describe what you want and get personalized recommendations.',
};

export default function ChatPage() {
  return <ChatView />;
}
