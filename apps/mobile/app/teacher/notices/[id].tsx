import { useLocalSearchParams } from 'expo-router';
import { PortalNoticeDetailScreen } from '@/screens/portal';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PortalNoticeDetailScreen role="teacher" id={id} />;
}
