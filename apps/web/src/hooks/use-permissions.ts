'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { hasAnyPermission, hasPermission, type Permission } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();

  const can = useCallback(
    (permission: Permission | Permission[]) => hasPermission(user, permission),
    [user],
  );

  const canAny = useCallback(
    (permissions: Permission[]) => hasAnyPermission(user, permissions),
    [user],
  );

  return useMemo(() => ({ user, can, canAny }), [user, can, canAny]);
}
