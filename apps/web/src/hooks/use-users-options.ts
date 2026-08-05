'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

export interface UserOption {
  id: string;
  fullName: string;
  staffCode?: string;
}

export function useUsersOptions(
  token: string | null | undefined,
  branchId: string,
  options: { enabled?: boolean; role?: string; limit?: number } = {},
) {
  const { enabled = true, role, limit = 100 } = options;
  const params = { limit, ...(role ? { role } : {}) };

  return useQuery({
    queryKey: queryKeys.usersOptions(branchId, params),
    queryFn: () => {
      const search = new URLSearchParams({
        branchId,
        limit: String(limit),
      });
      if (role) search.set('role', role);
      return apiClient<{ data: UserOption[] }>(`/users/options?${search}`, { token });
    },
    enabled: enabled && !!token && !!branchId,
    ...referenceQueryOptions(),
  });
}
