import { useLocalSearchParams } from 'expo-router';
import { ParentChildDetailScreen } from '@/screens/portal';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ParentChildDetailScreen id={id} />;
}
