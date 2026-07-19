import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { ErrorView, LoadingView, EmptyView } from '@/components/Screen';
import { Card, ListRow, Screen, StatRow } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE, buildPortalQuery, portalBase } from '@/lib/config';
import type { PortalFeesResponse } from '@/lib/types';

export default function FeesScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const base = portalBase();

  const query = useQuery({
    queryKey: ['fees', base, selectedStudentId],
    queryFn: () =>
      apiClient<PortalFeesResponse>(
        `/portal/${base}/fees${buildPortalQuery(
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
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load fees'} />
      </SafeAreaView>
    );
  }

  const { outstanding, invoices } = query.data!;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Fees" subtitle="Invoices and outstanding balance">
        {APP_ROLE === 'parent' ? <ChildSwitcher /> : null}

        <Card>
          <StatRow label="Outstanding" value={`PKR ${outstanding}`} />
        </Card>

        {invoices.data.length === 0 ? (
          <EmptyView message="No invoices found." />
        ) : (
          invoices.data.map((invoice) => (
            <ListRow
              key={invoice.id}
              title={invoice.feeType?.name ?? 'Fee'}
              subtitle={`PKR ${invoice.netAmount} · ${invoice.status?.label ?? 'Unknown'}`}
            />
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}
