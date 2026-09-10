'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AccessCatalogResponse,
  AccessModuleFlagDto,
  AccessRolesResponse,
  UserAccessResponse,
} from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { AccessMatrix } from '@/components/features/access/access-matrix';

export function UserAccessPanel({ userId }: { userId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AccessModuleFlagDto[] | null>(null);

  const catalogQuery = useQuery({
    queryKey: queryKeys.accessCatalog,
    queryFn: () => apiClient<AccessCatalogResponse>('/access/catalog', { token }),
    enabled: !!token,
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.accessRoles,
    queryFn: () => apiClient<AccessRolesResponse>('/access/roles', { token }),
    enabled: !!token,
  });

  const accessQuery = useQuery({
    queryKey: queryKeys.userAccess(userId),
    queryFn: () => apiClient<UserAccessResponse>(`/users/${userId}/access`, { token }),
    enabled: !!token && !!userId,
  });

  useEffect(() => {
    setDraft(null);
  }, [accessQuery.data?.role?.id, userId]);

  const flags = draft ?? accessQuery.data?.effective ?? [];
  const dirty =
    !!accessQuery.data &&
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(accessQuery.data.effective);

  const roleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiClient<UserAccessResponse>(`/users/${userId}/role`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ roleId }),
      }),
    onSuccess: async () => {
      toast.success('Template updated');
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.userAccess(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId) }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (modules: AccessModuleFlagDto[]) =>
      apiClient<UserAccessResponse>(`/users/${userId}/access`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ modules }),
      }),
    onSuccess: async () => {
      toast.success('User access updated');
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.userAccess(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId) }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!catalogQuery.data || !accessQuery.data) {
    return <p className="text-sm text-[var(--text-sub-500)]">Loading access…</p>;
  }

  const access = accessQuery.data;
  const roleOptions = (rolesQuery.data?.data ?? [])
    .filter((role) => !role.isLocked)
    .map((role) => ({ value: role.id, label: role.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-64">
          <label className="mb-1 block text-sm text-[var(--text-sub-500)]">Template</label>
          <SelectDropdown
            value={access.role?.id ?? ''}
            onValueChange={(value) => roleMutation.mutate(value)}
            options={roleOptions}
            placeholder="Select template"
            fullWidth
            disabled={access.isLocked || roleMutation.isPending}
          />
        </div>
        <div className="flex items-center gap-2">
          {access.differsFromTemplate && !access.isLocked && (
            <span className="text-xs font-medium text-[var(--institution-primary)]">
              Customized from template
            </span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={access.isLocked || !dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(flags)}
          >
            Save access
          </Button>
        </div>
      </div>
      {access.isLocked ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Super Admin access is locked and always includes every module.
        </p>
      ) : (
        <AccessMatrix
          catalog={catalogQuery.data}
          flags={flags}
          overrides={access.overrides}
          disabled={access.isLocked}
          onChange={setDraft}
        />
      )}
    </div>
  );
}
