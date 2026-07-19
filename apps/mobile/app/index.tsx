import { Redirect } from 'expo-router';
import { LoadingView } from '@/components/Screen';
import { useAuth } from '@/lib/auth-context';

export default function Index() {
  const { user, loading, roleError } = useAuth();

  if (loading) {
    return <LoadingView />;
  }

  if (roleError) {
    return <Redirect href="/login" />;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
