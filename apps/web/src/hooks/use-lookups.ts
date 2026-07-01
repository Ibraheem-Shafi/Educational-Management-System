'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';

interface LookupStatus {
  id: string;
  code: string;
  label: string;
  sortOrder?: number;
}

export function useLookups(
  lookupType: string,
  token?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.lookups(lookupType),
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>(`/settings/lookups/${lookupType}`, { token }),
    enabled: token !== undefined ? !!token : true,
    ...referenceQueryOptions(),
  });
}
