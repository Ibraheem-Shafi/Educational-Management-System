import { useLocalSearchParams } from 'expo-router';
import { PortalLearningDetailScreen } from '@/screens/portal';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PortalLearningDetailScreen role="student" id={id} />;
}
