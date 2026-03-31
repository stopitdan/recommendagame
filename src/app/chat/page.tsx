import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
// import ChatView from './ChatView'; // Hidden until paid tier

export const metadata: Metadata = {
  title: 'Board Game Sommelier | boredgame.lol',
  description: 'Chat with our AI board game expert to find your perfect game. Describe what you want and get personalized recommendations.',
};

export default function ChatPage() {
  // Chat is hidden until paid tier is available.
  // All code remains — just uncomment ChatView and remove the redirect.
  redirect('/');
  // return <ChatView />;
}
