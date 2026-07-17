import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { Card, ListRow, Screen, StatRow } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, buildPortalQuery, portalBase } from '@/lib/config';
import type { PortalAttendanceResponse } from '@/lib/types';

export default function AttendanceScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['attendance', base, selectedStudentId],
    queryFn: () =>
      apiClient<PortalAttendanceResponse>(
        `/portal/${base}/attendance${buildPortalQuery(
          APP_ROLE === 'parent' ? { studentId: selectedStudentId ?? undefined } : {},
        )}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (APP_ROLE === 'student' || !!selectedStudentId),
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load attendance'} />
      </SafeAreaView>
    );
  }

  const { summary, records } = query.data!;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Attendance" subtitle={`Present rate: ${summary.presentRate}%`}>
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}

        <Card>
          <StatRow label="Present" value={summary.present} />
          <StatRow label="Absent" value={summary.absent} />
          <StatRow label="Late" value={summary.late} />
        </Card>

        {records.data.length === 0 ? (
          <EmptyView message="No attendance records yet." />
        ) : (
          records.data.map((record) => (
            <ListRow
              key={record.id}
              title={record.date}
              subtitle={record.status?.label ?? 'Unknown'}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
