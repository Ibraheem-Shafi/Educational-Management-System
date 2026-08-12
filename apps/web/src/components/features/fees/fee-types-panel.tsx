'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createFeeTypeSchema, updateFeeTypeSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { Button } from '@/components/ui/button';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export type FeeTypeRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
};

function slugifyCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

type ActiveFilter = '' | 'true' | 'false';

export function FeeTypesPanel({ canManage }: { canManage: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeTypeRow | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');

  const createForm = useFormErrors(createFeeTypeSchema);
  const editForm = useFormErrors(updateFeeTypeSchema);
  const activeForm = editing ? editForm : createForm;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const listParams: Record<string, string> = {};
  if (search.trim()) listParams.search = search.trim();
  if (activeFilter === 'true') {
    listParams.isActive = 'true';
  } else if (activeFilter === 'false') {
    listParams.isActive = 'false';
    listParams.includeInactive = 'true';
  } else {
    listParams.includeInactive = 'true';
  }

  const listQuery = new URLSearchParams(listParams).toString();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.feeTypes({
      search: search.trim() || undefined,
      activeFilter: activeFilter || 'all',
    }),
    queryFn: () =>
      apiClient<{ data: FeeTypeRow[] }>(`/fee-types?${listQuery}`, { token }),
    enabled: !!token,
  });

  useEffect(() => {
    if (!dialogOpen) {
      setEditing(null);
      setName('');
      setCode('');
      setCodeTouched(false);
      setDescription('');
      setIsActive(true);
      createForm.clearAll();
      editForm.clearAll();
    }
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: FeeTypeRow) => {
    setEditing(row);
    setName(row.name);
    setCode(row.code);
    setDescription(row.description ?? '');
    setIsActive(row.isActive);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const payload = {
          name: name.trim(),
          description: description.trim() || undefined,
          isActive,
        };
        if (!editForm.validate(payload)) throw new Error('validation');
        return apiClient(`/fee-types/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
      }
      const payload = {
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || undefined,
      };
      if (!createForm.validate(payload)) throw new Error('validation');
      return apiClient('/fee-types', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Fee type updated' : 'Fee type created');
      queryClient.invalidateQueries({ queryKey: ['fee-types'] });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      if (err.message === 'validation') return;
      if (handleFormValidationError(err, activeForm.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      apiClient(`/fee-types/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: next }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.next ? 'Fee type activated' : 'Fee type deactivated');
      queryClient.invalidateQueries({ queryKey: ['fee-types'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasFilters = Boolean(search.trim() || activeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-sub-500)]">
          Define fee categories such as Exam fee or Digitization fee. Then set amounts under
          Structures and bill via New / Generate invoices.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add fee type
          </button>
        )}
      </div>

      <FilterBar className="items-center">
        <SearchInput
          value={search}
          onValueChange={handleSearchChange}
          placeholder="Search name or code"
        />
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="All"
          value={activeFilter}
          onValueChange={(next) => setActiveFilter(next as ActiveFilter)}
          options={[
            { value: '', label: 'All' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setActiveFilter('');
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[720px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Name</th>
                <th className={dataTableThClass}>Code</th>
                <th className={dataTableThClass}>Description</th>
                <th className={dataTableThClass}>Status</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={5} rows={6} />}
              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load fee types
                  </td>
                </tr>
              )}
              {!isLoading && !error && (data?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-sub-500)]">
                    No fee types yet. Add types like Exam fee or Digitization fee.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                data?.data.map((row) => (
                  <tr key={row.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>{row.name}</td>
                    <td className={cn(dataTableTdClass, 'font-mono text-xs')}>{row.code}</td>
                    <td className={cn(dataTableTdClass, 'max-w-[240px] truncate')}>
                      {row.description || '—'}
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge
                        label={row.isActive ? 'Active' : 'Inactive'}
                        code={row.isActive ? 'active' : 'inactive'}
                      />
                    </td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      {canManage ? (
                        <RowActionsMenu
                          items={[
                            { label: 'Edit', onClick: () => openEdit(row) },
                            {
                              label: row.isActive ? 'Deactivate' : 'Activate',
                              onClick: () =>
                                toggleActive.mutate({ id: row.id, next: !row.isActive }),
                            },
                          ]}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-md" aria-describedby={undefined}>
          <div className="flex shrink-0 items-center gap-4 border-b border-stroke-soft-200 py-4 pl-5 pr-4">
            <div className="min-w-0 flex-1">
              <DialogTitle>{editing ? 'Edit fee type' : 'Add fee type'}</DialogTitle>
              <DialogDescription className="mt-1">
                {editing
                  ? 'Update the display name or status. Code stays fixed.'
                  : 'Create a new fee category for invoicing.'}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-neutral-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            className="space-y-4 px-5 py-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div>
              <FormFieldLabel required>Name</FormFieldLabel>
              <input
                className={activeForm.fieldClassName('name', modalFieldClassName)}
                value={name}
                onChange={(e) => {
                  const next = e.target.value;
                  setName(next);
                  activeForm.clearField('name');
                  if (!editing && !codeTouched) setCode(slugifyCode(next));
                }}
                placeholder="e.g. Exam Fee"
              />
              <FormFieldError message={activeForm.errors.name} />
            </div>
            <div>
              <FormFieldLabel required>Code</FormFieldLabel>
              <input
                className={activeForm.fieldClassName('code', modalFieldClassName)}
                value={code}
                disabled={!!editing}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value);
                  activeForm.clearField('code');
                }}
                placeholder="e.g. exam"
              />
              <FormFieldError message={activeForm.errors.code} />
              {editing ? (
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">Code cannot be changed after create.</p>
              ) : null}
            </div>
            <div>
              <FormFieldLabel>Description</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[80px] resize-y py-2')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (appears in invoice pickers)
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="flex-1 rounded-[10px] border border-stroke-soft-200 px-3 py-2 text-sm text-[var(--text-sub-500)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
