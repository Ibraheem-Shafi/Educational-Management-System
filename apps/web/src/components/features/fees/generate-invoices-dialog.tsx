'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useBatches } from '@/hooks/use-batches';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SearchableTagSelect } from '@/components/forms/searchable-tag-select';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { DateField } from '@/components/ui/date-field';
import { currentYearMonth } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { statusRowClass } from '@/components/layout/status-badge';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { openBulkInvoicePrint } from '@/lib/bulk-invoice-print';

type FeeType = { id: string; name: string; code?: string };

type PreviewStudent = {
  studentId: string;
  fullName: string;
  programId?: string | null;
  batchId?: string | null;
  programName?: string | null;
  batchName?: string | null;
  feeStructureId?: string | null;
  defaultAmount: number | null;
  suggestedAmount: number | null;
  dueDayOfMonth?: number | null;
  monthlyFeeWaived?: boolean;
  annualChargeMode?: string;
};

type PreviewResponse = {
  feeType: FeeType;
  feeTypes?: FeeType[];
  scope?: 'branch' | 'batch';
  feeStructureId: string | null;
  defaultAmount: number | null;
  dueDayOfMonth: number | null;
  students: PreviewStudent[];
};

type RowState = {
  studentId: string;
  fullName: string;
  programName: string | null;
  batchName: string | null;
  hasStructure: boolean;
  include: boolean;
  amount: string;
  policyNote: string | null;
};

type ScopeMode = 'branch' | 'batch';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function policyNoteForStudent(student: PreviewStudent, feeTypeCode?: string): string | null {
  if (feeTypeCode === 'monthly' && student.monthlyFeeWaived) return 'Monthly waived';
  if (feeTypeCode === 'annual') {
    if (student.annualChargeMode === 'waived') return 'Annual waived';
    if (student.annualChargeMode === 'deferred') return 'Annual deferred';
    if (student.annualChargeMode === 'installments') return 'Annual installments';
  }
  return null;
}

export function GenerateInvoicesDialog({
  open,
  onOpenChange,
  branchId,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  onGenerated?: (result: { created: number; invoiceIds: string[] }) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [pickedBranchId, setPickedBranchId] = useState('');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('branch');
  const [batchId, setBatchId] = useState('');
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [defaultAmount, setDefaultAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingPeriod, setBillingPeriod] = useState(currentYearMonth());
  const [rows, setRows] = useState<RowState[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ created: number; invoiceIds: string[] } | null>(
    null,
  );

  const effectiveBranchId = branchId || pickedBranchId;
  const effectiveBatchId = scopeMode === 'batch' ? batchId : '';

  const { data: batchesData } = useBatches(token, effectiveBranchId, undefined, open && !!effectiveBranchId);
  const { data: feeTypesData } = useQuery({
    queryKey: queryKeys.feeTypes(),
    queryFn: () => apiClient<{ data: FeeType[] }>('/fee-types', { token }),
    enabled: !!token && open,
  });

  const feeTypesList = feeTypesData?.data ?? [];
  const hasNoFeeTypes = !!feeTypesData && feeTypesList.length === 0;

  const previewEnabled =
    open &&
    !!token &&
    !!effectiveBranchId &&
    selectedTypeIds.length > 0 &&
    (scopeMode === 'branch' || !!effectiveBatchId);

  const {
    data: preview,
    isFetching: previewLoading,
    error: previewQueryError,
  } = useQuery({
    queryKey: [
      'fee-bulk-preview',
      effectiveBranchId,
      scopeMode,
      effectiveBatchId,
      [...selectedTypeIds].sort().join(','),
    ],
    queryFn: () =>
      apiClient<PreviewResponse>('/fee-structures/preview-invoices', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          feeTypeIds: selectedTypeIds,
          ...(effectiveBatchId ? { batchId: effectiveBatchId } : {}),
        }),
      }),
    enabled: previewEnabled,
    retry: false,
  });

  useEffect(() => {
    if (!open) {
      setPickedBranchId('');
      setScopeMode('branch');
      setBatchId('');
      setSelectedTypeIds([]);
      setDefaultAmount('');
      setDueDate('');
      setBillingPeriod(currentYearMonth());
      setRows([]);
      setPreviewError(null);
      setGenerated(null);
    }
  }, [open]);

  useEffect(() => {
    setBatchId('');
    setRows([]);
  }, [effectiveBranchId]);

  useEffect(() => {
    if (scopeMode === 'branch') {
      setBatchId('');
      setRows([]);
    }
  }, [scopeMode]);

  useEffect(() => {
    if (!preview) return;
    const amount = preview.defaultAmount;
    if (amount !== null && amount !== undefined) {
      setDefaultAmount(String(amount));
    } else {
      setDefaultAmount('');
    }
    setRows(
      preview.students.map((student) => {
        const suggested = student.suggestedAmount;
        return {
          studentId: student.studentId,
          fullName: student.fullName,
          programName: student.programName ?? null,
          batchName: student.batchName ?? null,
          hasStructure: suggested !== null && suggested > 0,
          include: false,
          amount: suggested !== null && suggested > 0 ? String(suggested) : '',
          policyNote: (preview.feeTypes ?? [preview.feeType])
            .map((type) => policyNoteForStudent(student, type.code))
            .find(Boolean) ?? null,
        };
      }),
    );
    setPreviewError(null);
  }, [preview]);

  useEffect(() => {
    if (previewQueryError) {
      setPreviewError(previewQueryError.message);
      setRows([]);
    }
  }, [previewQueryError]);

  const selectedRows = useMemo(() => rows.filter((row) => row.include), [rows]);
  const selectedTotal = useMemo(
    () =>
      selectedRows.reduce((sum, row) => {
        const amount = Number(row.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [selectedRows],
  );
  const hasInvalidAmount = selectedRows.some((row) => {
    const amount = Number(row.amount);
    return !Number.isFinite(amount) || amount <= 0;
  });
  const missingStructureCount = rows.filter((row) => !row.hasStructure).length;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const lines = rows
        .filter((row) => row.include)
        .map((row) => ({
          studentId: row.studentId,
          amount: roundMoney(Number(row.amount) || 0),
          include: true as const,
        }));
      if (lines.length === 0) {
        throw new Error('Select at least one student');
      }
      return apiClient<{ created: number; invoiceIds: string[] }>('/fee-structures/generate-invoices', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          feeTypeIds: selectedTypeIds,
          ...(effectiveBatchId ? { batchId: effectiveBatchId } : {}),
          ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
          billingPeriod,
          lines,
        }),
      });
    },
    onSuccess: (result) => {
      toast.success(`Created ${result.created} invoice${result.created === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-completed'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsFeeDefaulters() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesRevenueTrend });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMonthlyRevenue });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentFees() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalParentFees() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalParentStats });
      setGenerated({
        created: result.created,
        invoiceIds: result.invoiceIds ?? [],
      });
      onGenerated?.({
        created: result.created,
        invoiceIds: result.invoiceIds ?? [],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function applyDefaultToAll() {
    const amount = roundMoney(Number(defaultAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid default amount');
      return;
    }
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        amount: String(amount),
        hasStructure: true,
      })),
    );
  }

  function toggleAll(include: boolean) {
    setRows((prev) => prev.map((row) => ({ ...row, include })));
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBranchId || selectedTypeIds.length === 0) {
      toast.error('Select branch and at least one fee type');
      return;
    }
    if (scopeMode === 'batch' && !effectiveBatchId) {
      toast.error('Select a batch');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      toast.error('Select a billing month');
      return;
    }
    if (selectedRows.length === 0) {
      toast.error('Select at least one student');
      return;
    }
    if (hasInvalidAmount) {
      toast.error('Selected students must have an amount greater than 0');
      return;
    }
    generateMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Receipt className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{generated ? 'Invoices generated' : 'Generate invoices'}</DialogTitle>
            <DialogDescription className="mt-1">
              {generated
                ? 'Print them now, or close and find them at the top of the invoices table.'
                : 'One invoice per student per month, with the selected fee types as line items'}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {generated ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 px-5 py-6">
              <p className="text-sm text-[var(--text-main-900)]">
                Created {generated.created} invoice{generated.created === 1 ? '' : 's'}.
              </p>
              <p className="mt-2 text-sm text-[var(--text-sub-500)]">
                They are selected on the invoices table. Print opens bank vouchers in a new tab.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-stroke-soft-200 px-5 py-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={generated.invoiceIds.length === 0}
                onClick={() => openBulkInvoicePrint(generated.invoiceIds)}
                className={cn(
                  'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                Print {generated.created} invoice{generated.created === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleGenerate}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {!branchId && (
              <BranchSelectField
                value={pickedBranchId}
                onValueChange={setPickedBranchId}
              />
            )}

            <div>
              <FormFieldLabel required>Scope</FormFieldLabel>
              <SelectDropdown
                aria-label="Scope"
                value={scopeMode}
                onValueChange={(value) => setScopeMode(value as ScopeMode)}
                options={[
                  { value: 'branch', label: 'Entire branch' },
                  { value: 'batch', label: 'Single batch' },
                ]}
                className="w-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {scopeMode === 'batch' && (
                <div>
                  <FormFieldLabel required>Batch</FormFieldLabel>
                  <SelectDropdown
                    aria-label="Batch"
                    placeholder="Select batch"
                    value={batchId}
                    onValueChange={(value) => {
                      setBatchId(value);
                      setRows([]);
                    }}
                    options={[
                      { value: '', label: 'Select batch' },
                      ...((batchesData?.data ?? []).map((b) => ({
                        value: b.id,
                        label: b.name,
                      })) as Array<{ value: string; label: string }>),
                    ]}
                    className="w-full"
                  />
                </div>
              )}
              <div className={scopeMode === 'branch' ? 'sm:col-span-2' : undefined}>
                <FormFieldLabel required>Fee types</FormFieldLabel>
                <SearchableTagSelect
                  options={feeTypesList.map((type) => ({
                    id: type.id,
                    label: type.name,
                    hint: type.code ?? null,
                  }))}
                  selectedIds={selectedTypeIds}
                  onChange={(ids) => {
                    setSelectedTypeIds(ids);
                    setRows([]);
                  }}
                  placeholder="Search fee types"
                  emptyText={hasNoFeeTypes ? 'No fee types yet' : 'No matching fee types'}
                />
                {hasNoFeeTypes && (
                  <p className="mt-1.5 text-xs text-[var(--base-muted-foreground,#71717A)]">
                    No fee types yet. Add types like Exam or Digitization on the Fee types tab first.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel htmlFor="bulk-default-amount">Amount</FormFieldLabel>
                <div className="flex gap-2">
                  <input
                    id="bulk-default-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value)}
                    className={cn(modalFieldClassName, 'flex-1')}
                  />
                  <button
                    type="button"
                    onClick={applyDefaultToAll}
                    disabled={rows.length === 0}
                    className="shrink-0 rounded-lg border border-stroke-soft-200 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Apply to all
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  Prefills from fee structures when they exist. Enter an amount here if a type has no
                  structure, then apply and add students.
                </p>
              </div>
              <div>
                <FormFieldLabel htmlFor="bulk-billing-period" required>
                  Billing month
                </FormFieldLabel>
                <input
                  id="bulk-billing-period"
                  type="month"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  className={modalFieldClassName}
                />
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  Bank voucher number is unique per student and this month.
                </p>
              </div>
              <div>
                <FormFieldLabel htmlFor="bulk-due-date">Due date</FormFieldLabel>
                <DateField
                  id="bulk-due-date"
                  value={dueDate}
                  onValueChange={setDueDate}
                  className={modalFieldClassName}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text-main-900)]">Students</p>
                {selectedRows.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-[var(--text-sub-500)] underline"
                    onClick={() => toggleAll(false)}
                  >
                    Clear selected
                  </button>
                )}
              </div>

              {missingStructureCount > 0 && (
                <p className="text-xs text-[var(--text-sub-500)]">
                  {missingStructureCount} student{missingStructureCount === 1 ? '' : 's'} have no fee
                  structure for the selected types. You can still add them and type an amount.
                </p>
              )}

              <SearchableTagSelect
                options={rows.map((row) => ({
                  id: row.studentId,
                  label: row.fullName,
                  hint: [row.programName, row.batchName, row.policyNote].filter(Boolean).join(' · ') || null,
                }))}
                selectedIds={selectedRows.map((row) => row.studentId)}
                onChange={(ids) => {
                  const next = new Set(ids);
                  setRows((prev) =>
                    prev.map((row) => ({
                      ...row,
                      include: next.has(row.studentId),
                    })),
                  );
                }}
                placeholder={
                  previewEnabled ? 'Search students and add them' : 'Select a fee type first'
                }
                emptyText={
                  !previewEnabled
                    ? scopeMode === 'batch'
                      ? 'Select a batch and fee type first'
                      : 'Select a fee type first'
                    : previewLoading
                      ? 'Loading students…'
                      : 'No matching students'
                }
                disabled={!previewEnabled || previewLoading}
                selectAllLabel={
                  rows.length > 0 ? `Add all students (${rows.length})` : undefined
                }
                onSelectAll={rows.length > 0 ? () => toggleAll(true) : undefined}
              />

              {previewError && (
                <p className="text-sm text-red-600">{previewError}</p>
              )}

              {selectedRows.length > 0 && (
                <div className={dataTableWrapperClass}>
                  <table className={cn(dataTableClass, 'min-w-[640px]')}>
                    <thead>
                      <tr>
                        <th className={dataTableThClass}>Student</th>
                        <th className={dataTableThClass}>Program / batch</th>
                        <th className={cn(dataTableThClass, 'w-40')}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row) => (
                        <tr
                          key={row.studentId}
                          className={statusRowClass(
                            row.hasStructure ? 'active' : 'pending',
                            row.hasStructure ? 'Active' : 'Pending',
                          )}
                        >
                          <td className={dataTableTdClass}>
                            <div>{row.fullName}</div>
                            {row.policyNote ? (
                              <div className="text-xs text-[var(--text-sub-500)]">{row.policyNote}</div>
                            ) : null}
                            {!row.hasStructure && (
                              <div className="text-xs text-amber-700">No fee structure</div>
                            )}
                          </td>
                          <td className={dataTableTdClass}>
                            <div className="text-sm">
                              {[row.programName, row.batchName].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </td>
                          <td className={dataTableTdClass}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={row.amount}
                              onChange={(e) => {
                                const next = e.target.value;
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.studentId === row.studentId
                                      ? {
                                          ...r,
                                          amount: next,
                                          hasStructure: Number(next) > 0 || r.hasStructure,
                                        }
                                      : r,
                                  ),
                                );
                              }}
                              className={cn(modalFieldClassName, 'w-full')}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rows.length > 0 && (
                <p className="text-sm text-[var(--text-sub-500)]">
                  {selectedRows.length} selected · Total {formatCurrency(selectedTotal)}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stroke-soft-200 px-5 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                generateMutation.isPending ||
                selectedRows.length === 0 ||
                hasInvalidAmount ||
                !effectiveBranchId ||
                selectedTypeIds.length === 0 ||
                (scopeMode === 'batch' && !effectiveBatchId)
              }
              className={cn(
                'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {generateMutation.isPending
                ? 'Generating…'
                : `Generate ${selectedRows.length || ''} invoice${selectedRows.length === 1 ? '' : 's'}`.trim()}
            </button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
