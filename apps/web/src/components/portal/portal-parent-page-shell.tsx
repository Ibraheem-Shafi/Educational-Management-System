'use client';

import { Suspense, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PORTAL_PARENT_KEY, type ParentPortalData } from '@/lib/portal-types';
import { usePortalChildId } from '@/lib/portal-child-context';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';

function PortalParentPageShellInner({
  children,
  requiresChild = true,
}: {
  children: (ctx: {
    data: ParentPortalData;
    childId: string;
    setChildId: (id: string) => void;
    selectedChild: ParentPortalData['children'][number] | undefined;
    childHref: (basePath: string, id?: string) => string;
  }) => ReactNode;
  requiresChild?: boolean;
}) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, error } = useQuery({
    queryKey: PORTAL_PARENT_KEY,
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token }),
    enabled: !!token,
  });

  const portalChildren = data?.children ?? [];
  const { childId, setChildId, selectedChild, childHref } = usePortalChildId(portalChildren);

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load portal data.</p>;

  if (!data) return <PortalPageSkeleton />;

  if (portalChildren.length === 0) {
    return (
      <ContentPanel>
        <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No linked children</p>
      </ContentPanel>
    );
  }

  const childOptions = portalChildren.map((c) => ({
    value: c.student.id,
    label: c.student.fullName,
  }));

  return (
    <div className="space-y-6">
      {requiresChild && portalChildren.length > 1 && (
        <FilterBar className="items-center">
          <SelectDropdown
            value={childId}
            onValueChange={setChildId}
            options={childOptions}
            placeholder="Select child"
            aria-label="Select child"
          />
        </FilterBar>
      )}

      {requiresChild && !selectedChild ? (
        <ContentPanel>
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">
            Select a child to view this section.
          </p>
        </ContentPanel>
      ) : (
        children({ data, childId, setChildId, selectedChild, childHref })
      )}
    </div>
  );
}

export function PortalParentPageShell(props: {
  children: (ctx: {
    data: ParentPortalData;
    childId: string;
    setChildId: (id: string) => void;
    selectedChild: ParentPortalData['children'][number] | undefined;
    childHref: (basePath: string, id?: string) => string;
  }) => ReactNode;
  requiresChild?: boolean;
}) {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <PortalParentPageShellInner {...props} />
    </Suspense>
  );
}
