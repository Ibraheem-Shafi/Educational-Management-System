import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorView, LoadingView } from '@/components/Screen';
import { Card, Screen, StatRow } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { portalBase } from '@/lib/config';
import type { PortalProfileResponse } from '@/lib/types';

export default function ProfileScreen() {
  const { accessToken, user } = useAuth();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['profile', base],
    queryFn: () =>
      apiClient<PortalProfileResponse>(`/portal/${base}/profile`, { token: accessToken }),
    enabled: !!accessToken,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load profile'} />
      </SafeAreaView>
    );
  }

  const profile = query.data!;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Profile">
        <Card>
          <StatRow label="Name" value={profile.user.fullName} />
          <StatRow label="Email" value={profile.user.email} />
          <StatRow label="Phone" value={profile.user.phone ?? '—'} />
          <StatRow label="Roles" value={profile.user.roles.join(', ')} />
        </Card>

        {profile.student ? (
          <Card>
            <StatRow label="Student ID" value={profile.student.id} />
            <StatRow label="Batch" value={profile.student.batch?.name ?? '—'} />
            <StatRow label="Program" value={profile.student.program?.name ?? '—'} />
          </Card>
        ) : null}

        {profile.parent ? (
          <Card>
            <StatRow label="Parent" value={profile.parent.fullName} />
            <StatRow label="Address" value={profile.parent.address ?? '—'} />
          </Card>
        ) : null}

        {profile.children && profile.children.length > 0 ? (
          <Card>
            {profile.children.map((child) => (
              <StatRow key={child.id} label={child.relationshipCode} value={child.fullName} />
            ))}
          </Card>
        ) : null}

        {!profile.student && !profile.parent && user ? (
          <Card>
            <StatRow label="Signed in as" value={user.fullName} />
          </Card>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
