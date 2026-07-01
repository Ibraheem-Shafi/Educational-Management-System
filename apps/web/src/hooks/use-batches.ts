'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

interface Batch {
  id: string;
  name: string;
  branchId: string;
}

export function useBatches(
  token: string | null | undefined,
  branchId: string,
  programId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.batches(branchId, programId),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (programId) params.set('programId', programId);
      return apiClient<{ data: Batch[] }>(`/batches?${params}`, { token });
    },
    enabled: enabled && !!token && !!branchId,
    ...referenceQueryOptions(),
  });
}
