import { Redirect } from 'expo-router';
import { LoadingView } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { homeHref } from '@/lib/role';

export default function Index() {
  const { user, appRole, loading, roleError } = useAuth();
  if (loading) return <LoadingView />;
  if (roleError || !user || !appRole) return <Redirect href="/(auth)/login" />;
  return <Redirect href={homeHref(appRole)} />;
}
