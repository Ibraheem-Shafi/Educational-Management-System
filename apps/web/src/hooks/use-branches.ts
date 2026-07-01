'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

interface Branch {
  id: string;
  name: string;
  code?: string;
  city?: string | null;
  isActive?: boolean;
}

export function useBranches(token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: Branch[] }>('/branches', { token }),
    enabled: !!token,
    ...referenceQueryOptions(),
  });
}

export function useEffectiveBranchId(
  token: string | null | undefined,
  userBranchId: string | null | undefined,
  selectedBranchId = '',
) {
  const { data: branches, isLoading: branchesLoading } = useBranches(token);
  const effectiveBranchId =
    selectedBranchId || userBranchId || branches?.data[0]?.id || '';

  return { effectiveBranchId, branches, branchesLoading };
}
