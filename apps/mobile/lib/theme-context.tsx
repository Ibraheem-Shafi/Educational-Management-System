import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './api';
import type { InstitutionSettings } from './types';

const DEFAULT_COLOR = '#1e40af';

interface ThemeContextValue {
  primaryColor: string;
  institutionName: string;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  primaryColor: DEFAULT_COLOR,
  institutionName: 'EIMS',
  loading: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['institution-settings'],
    queryFn: () => apiClient<InstitutionSettings>('/settings/institution'),
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo(
    () => ({
      primaryColor: data?.primaryColor ?? DEFAULT_COLOR,
      institutionName: data?.name ?? 'EIMS',
      loading: isLoading,
    }),
    [data, isLoading],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
