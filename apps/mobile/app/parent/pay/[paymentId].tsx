import { useLocalSearchParams } from 'expo-router';
import { PortalPayScreen } from '@/screens/portal';

export default function Page() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  return <PortalPayScreen role="parent" paymentId={paymentId} />;
}
