import { cache } from 'react';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { LIST_STALE_MS } from '@/lib/query-config';
import { queryKeys } from '@/lib/query-keys';
import { serverApiClient } from '@/lib/server-api';
import { getServerAccessToken } from '@/lib/server-session';
import type { AuthUser, InstitutionSettingsResponse } from '@eims/types';

export const getServerQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: LIST_STALE_MS,
          refetchOnWindowFocus: false,
        },
      },
    }),
);

export async function prefetchAuthenticatedQueries() {
  const token = await getServerAccessToken();
  const queryClient = getServerQueryClient();

  if (!token) {
    return { dehydratedState: dehydrate(queryClient), initialUser: null as AuthUser | null, token };
  }

  const [meResult, institutionResult] = await Promise.allSettled([
    serverApiClient<{ user: AuthUser }>('/auth/me', token),
    serverApiClient<InstitutionSettingsResponse>('/settings/institution', token),
    queryClient.prefetchQuery({
      queryKey: queryKeys.branches,
      queryFn: () => serverApiClient<{ data: unknown[] }>('/branches/options', token),
    }),
  ]);

  if (institutionResult.status === 'fulfilled') {
    queryClient.setQueryData(queryKeys.institutionSettings, institutionResult.value);
  }

  const initialUser = meResult.status === 'fulfilled' ? meResult.value.user : null;

  return {
    dehydratedState: dehydrate(queryClient),
    initialUser,
    token,
  };
}
