import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, buildPortalQuery, portalBase } from '@/lib/config';
import type { PaginatedResponse, PortalDocumentItem } from '@/lib/types';

export default function DocumentsScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['documents', base, selectedStudentId],
    queryFn: () =>
      apiClient<PaginatedResponse<PortalDocumentItem>>(
        `/portal/${base}/documents${buildPortalQuery(
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load documents'} />
      </SafeAreaView>
    );
  }

  const docs = query.data?.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Documents">
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}
        {docs.length === 0 ? (
          <EmptyView message="No documents available." />
        ) : (
          docs.map((doc) => (
            <ListRow
              key={doc.id}
              title={doc.title}
              subtitle={`${doc.category} · ${new Date(doc.createdAt).toLocaleDateString()}`}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
