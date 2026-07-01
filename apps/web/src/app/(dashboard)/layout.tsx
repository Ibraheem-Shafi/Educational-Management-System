import { DashboardShell } from '@/components/layout/dashboard-shell';
import { prefetchAuthenticatedQueries } from '@/lib/prefetch-authenticated';
import { AppProviders } from '@/providers/app-providers';
import { QueryHydration } from '@/providers/query-hydration';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dehydratedState, initialUser } = await prefetchAuthenticatedQueries();

  return (
    <QueryHydration state={dehydratedState}>
      <AppProviders initialUser={initialUser}>
        <DashboardShell>{children}</DashboardShell>
      </AppProviders>
    </QueryHydration>
  );
}
