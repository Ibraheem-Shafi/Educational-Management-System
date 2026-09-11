import React from 'react';
import { Redirect } from 'expo-router';
import { LoadingView } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { homeHref, type AppRole } from '@/lib/role';

export function RoleGate({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const { user, appRole, loading } = useAuth();
  if (loading) return <LoadingView />;
  if (!user || !appRole) return <Redirect href="/(auth)/login" />;
  if (appRole !== role) return <Redirect href={homeHref(appRole)} />;
  return <>{children}</>;
}
