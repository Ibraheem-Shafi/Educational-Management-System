'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

export interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

export function useSubjectsOptions(
  token: string | null | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 100 } = options;

  return useQuery({
    queryKey: queryKeys.subjectsOptions({ limit }),
    queryFn: () => {
      const search = new URLSearchParams({ limit: String(limit) });
      return apiClient<{ data: SubjectOption[] }>(`/subjects/options?${search}`, { token });
    },
    enabled: enabled && !!token,
    ...referenceQueryOptions(),
  });
}
