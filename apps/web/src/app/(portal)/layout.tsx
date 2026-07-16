import { PortalDashboardShell } from '@/components/layout/portal-shell';
import { prefetchAuthenticatedQueries } from '@/lib/prefetch-authenticated';
import { AppProviders } from '@/providers/app-providers';
import { QueryHydration } from '@/providers/query-hydration';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { dehydratedState, initialUser } = await prefetchAuthenticatedQueries();

  return (
    <QueryHydration state={dehydratedState}>
      <AppProviders initialUser={initialUser}>
        <PortalDashboardShell>{children}</PortalDashboardShell>
      </AppProviders>
    </QueryHydration>
  );
}
