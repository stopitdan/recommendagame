import { Metadata } from 'next';
import QuestionnaireFlow from './QuestionnaireFlow';

export const metadata: Metadata = {
  title: 'Find a Game | Recommend a Game',
  description: 'Answer a few questions and we\'ll recommend the perfect game for you.',
};

export default function QuestionnairePage() {
  return <QuestionnaireFlow />;
}
