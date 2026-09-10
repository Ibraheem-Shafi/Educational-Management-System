'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AccessCatalogResponse,
  AccessModuleFlagDto,
  AccessRoleSummary,
  AccessRolesResponse,
} from '@eims/types';
import { isSuperAdmin } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader, pageHeaderActionClassName } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { AccessMatrix } from '@/components/features/access/access-matrix';
import { cn } from '@/lib/utils';

export default function RolesAccessPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccessModuleFlagDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [copyFromId, setCopyFromId] = useState('');

  const catalogQuery = useQuery({
    queryKey: queryKeys.accessCatalog,
    queryFn: () => apiClient<AccessCatalogResponse>('/access/catalog', { token }),
    enabled: !!token && isSuperAdmin(user?.roles ?? []),
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.accessRoles,
    queryFn: () => apiClient<AccessRolesResponse>('/access/roles', { token }),
    enabled: !!token && isSuperAdmin(user?.roles ?? []),
  });

  const roles = rolesQuery.data?.data ?? [];
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;
  const flags = draft ?? selected?.modules ?? [];
  const dirty =
    !!selected &&
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(selected.modules);

  const saveMutation = useMutation({
    mutationFn: (modules: AccessModuleFlagDto[]) =>
      apiClient<AccessRoleSummary>(`/access/roles/${selected!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ modules }),
      }),
    onSuccess: async () => {
      toast.success('Template updated');
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.accessRoles });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<AccessRoleSummary>('/access/roles', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: newName.trim(),
          ...(copyFromId ? { copyFromRoleId: copyFromId } : {}),
        }),
      }),
    onSuccess: async (role) => {
      toast.success('Template created');
      setCreating(false);
      setNewName('');
      setCopyFromId('');
      setSelectedId(role.id);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.accessRoles });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      apiClient<AccessRoleSummary>(`/access/roles/${selected!.id}/reset`, {
        method: 'POST',
        token,
      }),
    onSuccess: async () => {
      toast.success('Template reset to defaults');
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.accessRoles });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isSuperAdmin(user?.roles ?? [])) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <PageHeader icon={Shield} title="Roles & access" description="Only Super Admin can edit access templates." />
      </div>
    );
  }

  if (catalogQuery.isLoading || rolesQuery.isLoading || !catalogQuery.data) {
    return <PageContentSkeleton />;
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Shield}
        title="Roles & access"
        description="Templates control what staff can view or edit. Super Admin always has full access."
        actions={
          <button type="button" className={pageHeaderActionClassName} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            New template
          </button>
        }
      />

      {creating && (
        <ContentPanel title="New template">
          <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm text-[var(--text-sub-500)]">Name</label>
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Fee clerk" />
            </div>
            <div className="sm:w-56">
              <label className="mb-1 block text-sm text-[var(--text-sub-500)]">Copy from</label>
              <SelectDropdown
                value={copyFromId || '__blank__'}
                onValueChange={(value) => setCopyFromId(value === '__blank__' ? '' : value)}
                options={[
                  { value: '__blank__', label: 'Blank' },
                  ...roles.map((role) => ({ value: role.id, label: role.name })),
                ]}
                placeholder="Blank"
                fullWidth
              />
            </div>
            <Button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </ContentPanel>
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ContentPanel title="Templates">
          <div className="flex flex-col p-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedId(role.id);
                  setDraft(null);
                }}
                className={cn(
                  'rounded-[10px] px-3 py-2 text-left text-sm',
                  selected?.id === role.id
                    ? 'bg-[var(--palette-navy-soft)] font-medium text-[var(--text-main-900)]'
                    : 'text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)]',
                )}
              >
                <span className="block">{role.name}</span>
                <span className="text-xs text-[var(--text-sub-500)]">
                  {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                  {role.isLocked ? ' · locked' : ''}
                </span>
              </button>
            ))}
          </div>
        </ContentPanel>

        <ContentPanel
          title={selected ? selected.name : 'Select a template'}
          actions={
            selected && !selected.isLocked ? (
              <div className="flex flex-wrap gap-2">
                {selected.isSystem && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resetMutation.isPending}
                    onClick={() => resetMutation.mutate()}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset defaults
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(flags)}
                >
                  Save
                </Button>
              </div>
            ) : null
          }
        >
          <div className="px-5 py-5">
            {selected?.isLocked && (
              <p className="mb-4 text-sm text-[var(--text-sub-500)]">
                Super Admin always has access to every module. This template cannot be changed.
              </p>
            )}
            {selected && (
              <AccessMatrix
                catalog={catalogQuery.data}
                flags={flags}
                disabled={selected.isLocked}
                onChange={selected.isLocked ? undefined : setDraft}
              />
            )}
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}
