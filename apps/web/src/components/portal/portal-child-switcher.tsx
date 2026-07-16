'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PORTAL_PARENT_KEY, type ParentPortalData } from '@/lib/portal-types';
import { usePortalChildId } from '@/lib/portal-child-context';
import { SelectDropdown } from '@/components/layout/select-dropdown';

function PortalChildSwitcherInner() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const isParent = user?.roles?.includes('parent');

  const { data } = useQuery({
    queryKey: PORTAL_PARENT_KEY,
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token }),
    enabled: !!token && isParent,
  });

  const children = data?.children ?? [];
  const { childId, setChildId } = usePortalChildId(children);

  if (!isParent || children.length === 0) return null;

  const options = children.map((c) => ({
    value: c.student.id,
    label: c.student.fullName,
  }));

  return (
    <SelectDropdown
      value={childId}
      onValueChange={setChildId}
      options={options}
      placeholder="Select child"
      aria-label="Select child"
      className="min-w-[140px] max-w-[200px]"
    />
  );
}

export function PortalChildSwitcher() {
  return (
    <Suspense fallback={null}>
      <PortalChildSwitcherInner />
    </Suspense>
  );
}
