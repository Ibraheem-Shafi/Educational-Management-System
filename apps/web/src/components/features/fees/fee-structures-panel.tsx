'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createFeeStructureSchema, formatCurrency, updateFeeStructureSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { withBranchScope } from '@/lib/branch-scope';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useBatches } from '@/hooks/use-batches';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { SearchInput } from '@/components/layout/search-input';
import { FilterBar } from '@/components/layout/filter-bar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
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
import type { FeeTypeRow } from '@/components/features/fees/fee-types-panel';

type ActiveFilter = '' | 'true' | 'false';

type StructureRow = {
  id: string;
  branchId: string;
  feeTypeId: string;
  feeType: { id: string; name: string; code: string } | null;
  programId: string | null;
  batchId: string | null;
  amount: number;
  dueDayOfMonth: number | null;
  isActive: boolean;
};

type ProgramOption = { id: string; name: string };

export function FeeStructuresPanel({
  canManage,
  branchId,
  scopeKey,
  effectiveScope,
}: {
  canManage: boolean;
  branchId: string;
  scopeKey: string;
  effectiveScope: Parameters<typeof withBranchScope>[1];
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StructureRow | null>(null);
  const [pickedBranchId, setPickedBranchId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFeeTypeId, setFilterFeeTypeId] = useState('');
  const [filterProgramId, setFilterProgramId] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('true');

  const formBranchId = editing?.branchId || branchId || pickedBranchId;
  const createForm = useFormErrors(createFeeStructureSchema);
  const editForm = useFormErrors(updateFeeStructureSchema);
  const activeForm = editing ? editForm : createForm;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const structureListExtra: Record<string, string | undefined> = {
    search: search.trim() || undefined,
    feeTypeId: filterFeeTypeId || undefined,
    programId: filterProgramId || undefined,
    batchId: filterBatchId || undefined,
  };
  if (activeFilter === 'true') {
    // Active only — default API behavior (omit includeInactive)
  } else if (activeFilter === 'false') {
    structureListExtra.includeInactive = 'true';
    structureListExtra.isActive = 'false';
  } else {
    structureListExtra.includeInactive = 'true';
  }

  const { data: structures, isLoading, error } = useQuery({
    queryKey: queryKeys.feeStructures({
      scopeKey,
      search: search.trim() || undefined,
      feeTypeId: filterFeeTypeId || undefined,
      programId: filterProgramId || undefined,
      batchId: filterBatchId || undefined,
      activeFilter: activeFilter || 'all',
    }),
    queryFn: () =>
      apiClient<{ data: StructureRow[] }>(
        withBranchScope('/fee-structures', effectiveScope, structureListExtra),
        { token },
      ),
    enabled: !!token,
  });

  const { data: feeTypes } = useQuery({
    queryKey: queryKeys.feeTypes(),
    queryFn: () => apiClient<{ data: FeeTypeRow[] }>('/fee-types', { token }),
    enabled: !!token,
  });

  const { data: programs } = useQuery({
    queryKey: ['programs', formBranchId],
    queryFn: () =>
      apiClient<{ data: ProgramOption[] }>(`/programs/options?branchId=${formBranchId}`, { token }),
    enabled: !!token && !!formBranchId && dialogOpen,
  });

  const filterProgramsBranchId = branchId || undefined;
  const { data: filterPrograms } = useQuery({
    queryKey: ['programs', 'structures-filter', filterProgramsBranchId || scopeKey],
    queryFn: async () => {
      if (!filterProgramsBranchId) return { data: [] as ProgramOption[] };
      return apiClient<{ data: ProgramOption[] }>(
        `/programs/options?branchId=${filterProgramsBranchId}`,
        { token },
      );
    },
    enabled: !!token && !!filterProgramsBranchId,
  });

  const { data: batches } = useBatches(token, formBranchId, programId || undefined, dialogOpen);
  const { data: filterBatches } = useBatches(
    token,
    branchId,
    filterProgramId || undefined,
    !!branchId,
  );

  const hasStructureFilters = Boolean(
    search.trim() ||
      filterFeeTypeId ||
      filterProgramId ||
      filterBatchId ||
      activeFilter !== 'true',
  );

  const programNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of programs?.data ?? []) map.set(p.id, p.name);
    return map;
  }, [programs?.data]);

  const batchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batches?.data ?? []) map.set(b.id, b.name);
    return map;
  }, [batches?.data]);

  // Load all programs/batches for table labels (not only dialog branch)
  const { data: allPrograms } = useQuery({
    queryKey: ['programs', 'all-for-structures', branchId || 'all'],
    queryFn: async () => {
      if (!branchId) return { data: [] as ProgramOption[] };
      return apiClient<{ data: ProgramOption[] }>(`/programs/options?branchId=${branchId}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const { data: allBatches } = useBatches(token, branchId, undefined, !!branchId);

  const tableProgramNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allPrograms?.data ?? []) map.set(p.id, p.name);
    return map;
  }, [allPrograms?.data]);

  const tableBatchNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of allBatches?.data ?? []) map.set(b.id, b.name);
    return map;
  }, [allBatches?.data]);

  useEffect(() => {
    if (!dialogOpen) {
      setEditing(null);
      setPickedBranchId('');
      setFeeTypeId('');
      setProgramId('');
      setBatchId('');
      setAmount('');
      setDueDay('');
      setIsActive(true);
      createForm.clearAll();
      editForm.clearAll();
    }
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: StructureRow) => {
    setEditing(row);
    setFeeTypeId(row.feeTypeId);
    setProgramId(row.programId ?? '');
    setBatchId(row.batchId ?? '');
    setAmount(String(row.amount));
    setDueDay(row.dueDayOfMonth != null ? String(row.dueDayOfMonth) : '');
    setIsActive(row.isActive);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const payload = {
          feeTypeId: feeTypeId || undefined,
          programId: programId || undefined,
          batchId: batchId || undefined,
          amount: amount ? Number(amount) : undefined,
          dueDayOfMonth: dueDay ? Number(dueDay) : undefined,
          isActive,
        };
        if (!editForm.validate(payload)) throw new Error('validation');
        return apiClient(`/fee-structures/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
      }
      const payload = {
        branchId: formBranchId,
        feeTypeId,
        programId: programId || undefined,
        batchId: batchId || undefined,
        amount: Number(amount),
        dueDayOfMonth: dueDay ? Number(dueDay) : undefined,
      };
      if (!createForm.validate(payload)) throw new Error('validation');
      return apiClient('/fee-structures', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Structure updated' : 'Structure created');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
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
      apiClient(`/fee-structures/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: next }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.next ? 'Structure activated' : 'Structure deactivated');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-sub-500)]">
          Default amounts used when generating invoices for a fee type (branch, or program/batch
          specific).
        </p>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add structure
          </button>
        )}
      </div>

      <FilterBar className="items-center">
        <SearchInput
          value={search}
          onValueChange={handleSearchChange}
          placeholder="Search fee type"
        />
        <SelectDropdown
          aria-label="Filter by fee type"
          placeholder="All fee types"
          value={filterFeeTypeId}
          onValueChange={setFilterFeeTypeId}
          options={[
            { value: '', label: 'All fee types' },
            ...(feeTypes?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
          ]}
        />
        <SelectDropdown
          aria-label="Filter by program"
          placeholder="All programs"
          value={filterProgramId}
          onValueChange={(next) => {
            setFilterProgramId(next);
            setFilterBatchId('');
          }}
          options={[
            { value: '', label: 'All programs' },
            ...(filterPrograms?.data ?? allPrograms?.data ?? []).map((p) => ({
              value: p.id,
              label: p.name,
            })),
          ]}
        />
        <SelectDropdown
          aria-label="Filter by batch"
          placeholder="All batches"
          value={filterBatchId}
          onValueChange={setFilterBatchId}
          options={[
            { value: '', label: 'All batches' },
            ...(filterBatches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
          ]}
        />
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="Active"
          value={activeFilter}
          onValueChange={(next) => setActiveFilter(next as ActiveFilter)}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
            { value: '', label: 'All' },
          ]}
        />
        {hasStructureFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setFilterFeeTypeId('');
              setFilterProgramId('');
              setFilterBatchId('');
              setActiveFilter('true');
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[800px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Fee type</th>
                <th className={dataTableThClass}>Program</th>
                <th className={dataTableThClass}>Batch</th>
                <th className={dataTableThClass}>Amount</th>
                <th className={dataTableThClass}>Due day</th>
                <th className={dataTableThClass}>Status</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={7} rows={6} />}
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load fee structures
                  </td>
                </tr>
              )}
              {!isLoading && !error && (structures?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-sub-500)]">
                    No structures yet. Add an amount for Exam, Digitization, or other fee types.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                structures?.data.map((row) => (
                  <tr key={row.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>{row.feeType?.name ?? '—'}</td>
                    <td className={dataTableTdClass}>
                      {row.programId
                        ? tableProgramNames.get(row.programId) ??
                          programNameById.get(row.programId) ??
                          '—'
                        : 'All'}
                    </td>
                    <td className={dataTableTdClass}>
                      {row.batchId
                        ? tableBatchNames.get(row.batchId) ?? batchNameById.get(row.batchId) ?? '—'
                        : 'All'}
                    </td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className={dataTableTdClass}>{row.dueDayOfMonth ?? '—'}</td>
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
              <DialogTitle>{editing ? 'Edit fee structure' : 'Add fee structure'}</DialogTitle>
              <DialogDescription className="mt-1">
                Set the default amount for a fee type in this branch.
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
            className="space-y-4 overflow-y-auto px-5 py-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            {!editing && !branchId && (
              <BranchSelectField
                value={pickedBranchId}
                onValueChange={(value) => {
                  setPickedBranchId(value);
                  setProgramId('');
                  setBatchId('');
                  createForm.clearField('branchId');
                }}
                error={createForm.errors.branchId}
              />
            )}

            <div>
              <FormFieldLabel required>Fee type</FormFieldLabel>
              <SelectDropdown
                aria-label="Fee type"
                value={feeTypeId}
                onValueChange={(value) => {
                  setFeeTypeId(value);
                  activeForm.clearField('feeTypeId');
                }}
                options={[
                  { value: '', label: 'Select fee type' },
                  ...(feeTypes?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
                ]}
                className="w-full"
                disabled={!!editing}
              />
              <FormFieldError message={activeForm.errors.feeTypeId} />
              {(feeTypes?.data.length ?? 0) === 0 && (
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  No active fee types. Create one under the Fee types tab first.
                </p>
              )}
            </div>

            <div>
              <FormFieldLabel>Program (optional)</FormFieldLabel>
              <SelectDropdown
                aria-label="Program"
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value);
                  setBatchId('');
                }}
                options={[
                  { value: '', label: 'All programs' },
                  ...(programs?.data.map((p) => ({ value: p.id, label: p.name })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel>Batch (optional)</FormFieldLabel>
              <SelectDropdown
                aria-label="Batch"
                value={batchId}
                onValueChange={setBatchId}
                options={[
                  { value: '', label: 'All batches' },
                  ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Amount</FormFieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                className={activeForm.fieldClassName('amount', modalFieldClassName)}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  activeForm.clearField('amount');
                }}
                placeholder="e.g. 5000"
              />
              <FormFieldError message={activeForm.errors.amount} />
            </div>

            <div>
              <FormFieldLabel>Due day of month</FormFieldLabel>
              <input
                type="number"
                min={1}
                max={28}
                className={activeForm.fieldClassName('dueDayOfMonth', modalFieldClassName)}
                value={dueDay}
                onChange={(e) => {
                  setDueDay(e.target.value);
                  activeForm.clearField('dueDayOfMonth');
                }}
                placeholder="1–28 (optional)"
              />
              <FormFieldError message={activeForm.errors.dueDayOfMonth} />
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
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
