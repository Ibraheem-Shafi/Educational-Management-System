'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, createContractSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { statusRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { cn } from '@/lib/utils';

interface ContractRow {
  id: string;
  startDate: string;
  endDate: string | null;
  employmentType: string;
  status: string;
  salaryNote: string | null;
}

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
];

const CONTRACT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'ended', label: 'Ended' },
  { value: 'terminated', label: 'Terminated' },
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UserContractsSection({
  userId,
  branchId,
}: {
  userId: string;
  branchId: string | null;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.HR_MANAGE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    employmentType: 'full_time',
    status: 'active',
    salaryNote: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createContractSchema);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-contracts', userId, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<ContractRow>>(
        `/hr/contracts?userId=${userId}&page=${page}&limit=${limit}`,
        { token },
      ),
    enabled: !!token && !!userId,
    placeholderData: (previous) => previous,
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const resetForm = () => {
    setForm({ startDate: '', endDate: '', employmentType: 'full_time', status: 'active', salaryNote: '' });
    clearAll();
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/hr/contracts', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Contract added');
      queryClient.invalidateQueries({ queryKey: ['hr-contracts', userId] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/hr/contracts/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Contract removed');
      queryClient.invalidateQueries({ queryKey: ['hr-contracts', userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    const payload = {
      userId,
      branchId,
      startDate: form.startDate,
      endDate: form.endDate || null,
      employmentType: form.employmentType,
      status: form.status,
      salaryNote: form.salaryNote.trim() || null,
    };
    if (!validate(payload)) return;
    createMutation.mutate(payload);
  };

  const contracts = data?.data ?? [];

  return (
    <div className="space-y-4">
      {canManage && branchId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-1.5 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
          >
            <Plus className="h-4 w-4" />
            Add contract
          </button>
        </div>
      )}
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Start</th>
              <th className={dataTableThClass}>End</th>
              <th className={dataTableThClass}>Type</th>
              <th className={dataTableThClass}>Status</th>
              {canManage && <th className={dataTableThClass}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 5 : 4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                  Loading…
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <EmptyStateCell colSpan={canManage ? 5 : 4} title="No contracts recorded" />
            ) : (
              contracts.map((c) => (
                <tr key={c.id} className={statusRowClass(c.status, formatLabel(c.status))}>
                  <td className={dataTableTdClass}>{c.startDate}</td>
                  <td className={dataTableTdClass}>{c.endDate ?? '—'}</td>
                  <td className={dataTableTdClass}>{formatLabel(c.employmentType)}</td>
                  <td className={dataTableTdClass}>{formatLabel(c.status)}</td>
                  {canManage && (
                    <td className={dataTableTdClass}>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(c.id)}
                        className="text-sm text-red-600 hover:underline"
                        disabled={deleteMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data?.meta && data.meta.totalPages > 0 && (
        <PaginationBar
          page={page}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={handleLimitChange}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0" aria-describedby={undefined}>
          <div className="border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            <DialogTitle>Add employment contract</DialogTitle>
            <DialogDescription className="mt-1">Record a new contract for this staff member</DialogDescription>
          </div>
          <form className="space-y-4 px-5 py-4" noValidate onSubmit={handleSubmit}>
            <div>
              <FormFieldLabel required>Start date</FormFieldLabel>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  setForm((f) => ({ ...f, startDate: e.target.value }));
                  clearField('startDate');
                }}
                className={fieldClassName('startDate', modalFieldClassName)}
              />
              <FormFieldError message={errors.startDate} />
            </div>
            <div>
              <FormFieldLabel>End date</FormFieldLabel>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => {
                  setForm((f) => ({ ...f, endDate: e.target.value }));
                  clearField('endDate');
                }}
                className={fieldClassName('endDate', modalFieldClassName)}
              />
              <FormFieldError message={errors.endDate} />
            </div>
            <div>
              <FormFieldLabel required>Employment type</FormFieldLabel>
              <SelectDropdown
                aria-label="Employment type"
                value={form.employmentType}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, employmentType: v }));
                  clearField('employmentType');
                }}
                options={EMPLOYMENT_TYPES}
                fullWidth
              />
              <FormFieldError message={errors.employmentType} />
            </div>
            <div>
              <FormFieldLabel>Status</FormFieldLabel>
              <SelectDropdown
                aria-label="Status"
                value={form.status}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, status: v }));
                  clearField('status');
                }}
                options={CONTRACT_STATUSES}
                fullWidth
              />
              <FormFieldError message={errors.status} />
            </div>
            <div>
              <FormFieldLabel>Salary note</FormFieldLabel>
              <input
                type="text"
                value={form.salaryNote}
                onChange={(e) => {
                  setForm((f) => ({ ...f, salaryNote: e.target.value }));
                  clearField('salaryNote');
                }}
                className={fieldClassName('salaryNote', modalFieldClassName)}
              />
              <FormFieldError message={errors.salaryNote} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setDialogOpen(false)} className="flex-1 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] py-2 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="flex-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] py-2 text-sm font-medium text-white disabled:opacity-50">
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
