import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, buildPortalQuery, portalBase } from '@/lib/config';
import type { PaginatedResponse, PortalNoticeItem } from '@/lib/types';

export default function NoticesScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['notices', base, selectedStudentId],
    queryFn: () =>
      apiClient<PaginatedResponse<PortalNoticeItem>>(
        `/portal/${base}/notices${buildPortalQuery(
          APP_ROLE === 'parent' ? { studentId: selectedStudentId ?? undefined } : {},
        )}`,
        { token: accessToken },
      ),
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load notices'} />
      </SafeAreaView>
    );
  }

  const notices = query.data?.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Notices">
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}
        {notices.length === 0 ? (
          <EmptyView message="No notices published." />
        ) : (
          notices.map((notice) => (
            <ListRow
              key={notice.id}
              title={notice.title}
              subtitle={notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : notice.body.slice(0, 80)}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
