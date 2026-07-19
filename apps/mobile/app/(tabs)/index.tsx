import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView } from '@/components/Screen';
import { Card, Screen, StatRow } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, portalBase } from '@/lib/config';
import { useTheme } from '@/lib/theme-context';
import type {
  ParentPortalData,
  PortalParentStatsResponse,
  PortalStudentStatsResponse,
  StudentPortalData,
} from '@/lib/types';

export default function HomeScreen() {
  const { accessToken, user } = useAuth();
  const { institutionName } = useTheme();
  const { selectedStudentId, setSelectedStudentId } = useChildContext();
  const base = portalBase();

  const parentPortal = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: APP_ROLE === 'parent' && !!accessToken,
  });

  useEffect(() => {
    if (APP_ROLE !== 'parent' || !parentPortal.data?.children.length) return;
    if (!selectedStudentId) {
      setSelectedStudentId(parentPortal.data.children[0].student.id);
    }
  }, [parentPortal.data, selectedStudentId, setSelectedStudentId]);

  const statsQuery = useQuery({
    queryKey: ['portal-stats', base],
    queryFn: () =>
      apiClient<PortalStudentStatsResponse | PortalParentStatsResponse>(
        `/portal/${base}/stats`,
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });

  const studentPortal = useQuery({
    queryKey: ['portal-student'],
    queryFn: () => apiClient<StudentPortalData>('/portal/student', { token: accessToken }),
    enabled: APP_ROLE === 'student' && !!accessToken,
  });

  const loading = statsQuery.isLoading || (APP_ROLE === 'parent' ? parentPortal.isLoading : studentPortal.isLoading);
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (statsQuery.error) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ErrorView message={statsQuery.error instanceof Error ? statsQuery.error.message : 'Failed to load'} />
      </SafeAreaView>
    );
  }

  const stats = statsQuery.data;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen
        title={`Welcome, ${user?.fullName?.split(' ')[0] ?? 'there'}`}
        subtitle={institutionName}
      >
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}

        <Card>
          {APP_ROLE === 'student' && stats && 'attendanceRate' in stats ? (
            <>
              <StatRow label="Attendance rate" value={`${stats.attendanceRate.value}%`} />
              <StatRow label="Outstanding fees" value={`PKR ${stats.outstandingFees.value}`} />
              <StatRow label="Average grade" value={`${stats.averageGrade.value}%`} />
              <StatRow label="Upcoming classes" value={stats.upcomingClasses.value} />
            </>
          ) : null}
          {APP_ROLE === 'parent' && stats && 'childrenCount' in stats ? (
            <>
              <StatRow label="Children" value={stats.childrenCount.value} />
              <StatRow label="Aggregate attendance" value={`${stats.aggregateAttendance.value}%`} />
              <StatRow label="Total outstanding" value={`PKR ${stats.totalOutstanding.value}`} />
              <StatRow label="Recent notices" value={stats.recentNotices.value} />
            </>
          ) : null}
        </Card>

        {APP_ROLE === 'student' && studentPortal.data?.student ? (
          <Card>
            <StatRow label="Student" value={studentPortal.data.student.fullName} />
            {studentPortal.data.student.batch?.name ? (
              <StatRow label="Batch" value={studentPortal.data.student.batch.name} />
            ) : null}
            {studentPortal.data.student.program?.name ? (
              <StatRow label="Program" value={studentPortal.data.student.program.name} />
            ) : null}
          </Card>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
