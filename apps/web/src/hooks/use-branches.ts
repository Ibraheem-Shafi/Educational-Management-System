'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';
import { getSingleBranchId } from '@eims/shared';
import { usePageBranchScopeOptional } from '@/hooks/use-page-branch-scope';

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
    queryFn: () => apiClient<{ data: Branch[] }>('/branches/options', { token }),
    enabled: !!token,
    ...referenceQueryOptions(),
  });
}

/**
 * Prefer `useEffectiveBranchScope()` for multi-branch support.
 * Returns a single branch id only when the effective scope is exactly one branch,
 * or when an explicit page `selectedBranchId` / assigned `userBranchId` is provided.
 * Does not fall back to the first catalog branch.
 */
export function useEffectiveBranchId(
  token: string | null | undefined,
  userBranchId: string | null | undefined,
  selectedBranchId = '',
) {
  const { data: branches, isLoading: branchesLoading } = useBranches(token);
  const page = usePageBranchScopeOptional();

  if (selectedBranchId) {
    return { effectiveBranchId: selectedBranchId, branches, branchesLoading };
  }

  if (page) {
    const single = getSingleBranchId(page.effectiveScope);
    return {
      effectiveBranchId: single || userBranchId || '',
      branches,
      branchesLoading,
    };
  }

  return {
    effectiveBranchId: userBranchId || '',
    branches,
    branchesLoading,
  };
}
