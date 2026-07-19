import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { Card, ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, portalBase } from '@/lib/config';
import { DAY_NAMES, type PortalTimetableResponse } from '@/lib/types';

export default function TimetableScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['timetable', base, selectedStudentId],
    queryFn: async () => {
      if (APP_ROLE === 'parent') {
        if (!selectedStudentId) return { slots: [], todaySlots: [] } as PortalTimetableResponse;
        return apiClient<PortalTimetableResponse>(
          `/portal/parent/timetable?studentId=${encodeURIComponent(selectedStudentId)}`,
          { token: accessToken },
        );
      }
      return apiClient<PortalTimetableResponse>('/portal/student/timetable', { token: accessToken });
    },
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load timetable'} />
      </SafeAreaView>
    );
  }

  const { todaySlots, slots } = query.data!;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Timetable">
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}

        <Card>
          {todaySlots.length === 0 ? (
            <EmptyView message="No classes scheduled today." />
          ) : (
            todaySlots.map((slot, index) => (
              <ListRow
                key={`today-${index}`}
                title={slot.subjectName ?? 'Class'}
                subtitle={`${slot.startTime}–${slot.endTime}${slot.room ? ` · ${slot.room}` : ''}`}
              />
            ))
          )}
        </Card>

        {slots.length === 0 ? (
          <EmptyView message="No timetable slots found." />
        ) : (
          slots.map((slot, index) => (
            <ListRow
              key={`slot-${index}`}
              title={slot.subjectName ?? 'Class'}
              subtitle={`${DAY_NAMES[slot.dayOfWeek] ?? ''} ${slot.startTime}–${slot.endTime}`}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
