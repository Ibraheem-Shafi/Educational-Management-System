'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { InstitutionSettingsResponse } from '@eims/types';

const InstitutionContext = createContext<InstitutionSettingsResponse | null>(null);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery({
    queryKey: queryKeys.institutionSettings,
    queryFn: () => apiClient<InstitutionSettingsResponse>('/settings/institution'),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--institution-primary', settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  return (
    <InstitutionContext.Provider value={settings ?? null}>{children}</InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const ctx = useContext(InstitutionContext);
  return useMemo(
    () => ({
      name: ctx?.name ?? process.env.NEXT_PUBLIC_INSTITUTION_NAME ?? 'Institution',
      logoUrl: ctx?.logoUrl ?? null,
      primaryColor: ctx?.primaryColor ?? '#2563eb',
      terminology: ctx?.terminology ?? {
        batch: 'Batch',
        program: 'Program',
        assessment: 'Test',
        session: 'Session',
      },
      featureFlags: ctx?.featureFlags,
      settings: ctx,
    }),
    [ctx],
  );
}
