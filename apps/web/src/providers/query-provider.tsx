'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { defaultQueryOptions } from '@/lib/query-config';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export { REFERENCE_STALE_MS, LIST_STALE_MS, referenceQueryOptions } from '@/lib/query-config';
