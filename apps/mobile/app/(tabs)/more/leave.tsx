import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, buildPortalQuery } from '@/lib/config';
import type { LeaveRequestItem } from '@/lib/types';

export default function LeaveScreen() {
  if (APP_ROLE !== 'parent') {
    return <Redirect href="/(tabs)/more" />;
  }

  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();

  const query = useQuery({
    queryKey: ['leave', selectedStudentId],
    queryFn: async () => {
      const res = await apiClient<{ data: LeaveRequestItem[] }>(
        `/portal/parent/leave${buildPortalQuery({ studentId: selectedStudentId ?? undefined })}`,
        { token: accessToken },
      );
      return res.data;
    },
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load leave requests'} />
      </SafeAreaView>
    );
  }

  const items = query.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Leave requests" subtitle="View submitted leave for your child">
        <ChildSwitcher />
        {items.length === 0 ? (
          <EmptyView message="No leave requests yet." />
        ) : (
          items.map((item) => (
            <ListRow
              key={item.id}
              title={`${item.fromDate} → ${item.toDate}`}
              subtitle={`${item.status} · ${item.reason}`}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
