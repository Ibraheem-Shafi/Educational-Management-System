'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

export interface StudentOption {
  id: string;
  fullName: string;
  rollNumber?: string | null;
  batchId?: string | null;
}

export function useStudentsOptions(
  token: string | null | undefined,
  branchId: string,
  enabled = true,
  limit = 100,
) {
  return useQuery({
    queryKey: queryKeys.studentsOptions(branchId, { limit }),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        limit: String(limit),
      });
      return apiClient<{ data: StudentOption[] }>(`/students/options?${params}`, { token });
    },
    enabled: enabled && !!token && !!branchId,
    ...referenceQueryOptions(),
  });
}
