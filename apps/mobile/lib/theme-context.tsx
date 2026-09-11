import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './api';
import { colors } from './theme';
import type { InstitutionSettings } from './types';

interface ThemeContextValue {
  primaryColor: string;
  institutionName: string;
  logoUrl: string | null;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  primaryColor: colors.teal,
  institutionName: 'Nexium Academy',
  logoUrl: null,
  loading: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['institution-settings'],
    queryFn: () => apiClient<InstitutionSettings>('/settings/institution'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const value = useMemo(
    () => ({
      primaryColor: data?.primaryColor || colors.teal,
      institutionName: data?.name ?? 'Nexium Academy',
      logoUrl: data?.logoUrl ?? null,
      loading: isLoading,
    }),
    [data, isLoading],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
