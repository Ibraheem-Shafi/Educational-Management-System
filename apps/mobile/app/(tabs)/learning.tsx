import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, portalBase } from '@/lib/config';
import type { LearningResourceItem, PaginatedResponse } from '@/lib/types';

type LearningListResponse = PaginatedResponse<LearningResourceItem>;

export default function LearningScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['learning', base, selectedStudentId],
    queryFn: async () => {
      if (APP_ROLE === 'parent') {
        if (!selectedStudentId) {
          return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } as LearningListResponse;
        }
        const params = new URLSearchParams({ studentId: selectedStudentId, limit: '20' });
        return apiClient<LearningListResponse>(`/portal/parent/learning?${params}`, { token: accessToken });
      }
      return apiClient<LearningListResponse>('/portal/student/learning?limit=20', { token: accessToken });
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load learning'} />
      </SafeAreaView>
    );
  }

  const items = query.data?.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Learning" subtitle="Homework, resources, and assignments">
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}

        {items.length === 0 ? (
          <EmptyView message="No learning items right now." />
        ) : (
          items.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              subtitle={[item.type, item.subjectName, item.dueDate ? `Due ${item.dueDate}` : null]
                .filter(Boolean)
                .join(' · ')}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
