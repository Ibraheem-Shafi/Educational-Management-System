'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, type BranchScope } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { withBranchScope } from '@/lib/branch-scope';
import { useBatches } from '@/hooks/use-batches';
import { useStudentsOptions } from '@/hooks/use-students-options';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/query-keys';
import { currentYearMonth } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type IncrementScope = 'all_campuses' | 'branch' | 'program' | 'batch' | 'student';
type FeeType = { id: string; name: string; code?: string };
type ProgramOption = { id: string; name: string };

type SampleChange = { id: string; name?: string; from: number; to: number };

type IncrementSummary = {
  dryRun: boolean;
  feeType: { id: string; name: string; code: string };
  structures: number;
  studentOverrides: number;
  unpaidInvoices: number;
  samples: {
    structures: SampleChange[];
    invoices: SampleChange[];
    overrides: SampleChange[];
  };
};

function sampleLabel(row: SampleChange) {
  return `${row.name ?? row.id.slice(-6)}: ${formatCurrency(row.from)} → ${formatCurrency(row.to)}`;
}

export function FeeIncrementDialog({
  open,
  onOpenChange,
  branchId,
  scope,
  canAllCampuses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  scope: BranchScope;
  canAllCampuses: boolean;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [pickedBranchId, setPickedBranchId] = useState('');
  const [incrementScope, setIncrementScope] = useState<IncrementScope>(
    canAllCampuses && !branchId ? 'all_campuses' : 'branch',
  );
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  const [effectiveFrom, setEffectiveFrom] = useState(currentYearMonth());
  const [preview, setPreview] = useState<IncrementSummary | null>(null);

  const effectiveBranchId = branchId || pickedBranchId;
  const needsCampus =
    incrementScope === 'branch' ||
    incrementScope === 'program' ||
    incrementScope === 'batch' ||
    incrementScope === 'student';

  const { data: feeTypesData } = useQuery({
    queryKey: queryKeys.feeTypes(),
    queryFn: () => apiClient<{ data: FeeType[] }>('/fee-types', { token }),
    enabled: !!token && open,
  });
  const feeTypesList = feeTypesData?.data ?? [];

  const { data: programs } = useQuery({
    queryKey: ['programs-options', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: ProgramOption[] }>(`/programs/options?branchId=${effectiveBranchId}`, {
        token,
      }),
    enabled: !!token && open && !!effectiveBranchId && incrementScope === 'program',
  });

  const { data: batchesData } = useBatches(
    token,
    effectiveBranchId,
    undefined,
    open && !!effectiveBranchId && incrementScope === 'batch',
  );
  const { data: students } = useStudentsOptions(
    token,
    effectiveBranchId,
    open && !!effectiveBranchId && incrementScope === 'student',
  );

  const scopeOptions = useMemo(
    () => [
      ...(canAllCampuses ? [{ value: 'all_campuses', label: 'All campuses' }] : []),
      { value: 'branch', label: 'This campus' },
      { value: 'program', label: 'Program' },
      { value: 'batch', label: 'Batch' },
      { value: 'student', label: 'One student' },
    ],
    [canAllCampuses],
  );

  useEffect(() => {
    if (!open) {
      setPickedBranchId('');
      setIncrementScope(canAllCampuses && !branchId ? 'all_campuses' : 'branch');
      setProgramId('');
      setBatchId('');
      setStudentId('');
      setFeeTypeId('');
      setMode('percent');
      setValue('10');
      setEffectiveFrom(currentYearMonth());
      setPreview(null);
    }
  }, [open, branchId, canAllCampuses]);

  useEffect(() => {
    if (!open) return;
    const monthly = feeTypesList.find((row) => row.code === 'monthly');
    if (monthly && !feeTypeId) setFeeTypeId(monthly.id);
  }, [open, feeTypesList, feeTypeId]);

  useEffect(() => {
    setPreview(null);
  }, [incrementScope, pickedBranchId, programId, batchId, studentId, feeTypeId, mode, value, effectiveFrom]);

  function buildPayload(dryRun: boolean) {
    return {
      dryRun,
      scope: incrementScope,
      ...(needsCampus && effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(incrementScope === 'program' ? { programId } : {}),
      ...(incrementScope === 'batch' ? { batchId } : {}),
      ...(incrementScope === 'student' ? { studentId } : {}),
      feeTypeId,
      mode,
      value: Number(value),
      effectiveFrom,
    };
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient<IncrementSummary>(withBranchScope('/fee-structures/increment', scope), {
        method: 'POST',
        token,
        body: JSON.stringify(buildPayload(true)),
      }),
    onSuccess: (result) => setPreview(result),
    onError: (err: Error) => toast.error(err.message),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      apiClient<IncrementSummary>(withBranchScope('/fee-structures/increment', scope), {
        method: 'POST',
        token,
        body: JSON.stringify(buildPayload(false)),
      }),
    onSuccess: (result) => {
      toast.success(
        `Updated ${result.structures} structure${result.structures === 1 ? '' : 's'} and ${result.unpaidInvoices} unpaid invoice${result.unpaidInvoices === 1 ? '' : 's'}`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.feeStructures() });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!feeTypeId) {
      toast.error('Select a fee type');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) {
      toast.error('Select an effective month');
      return;
    }
    if (!(Number(value) > 0)) {
      toast.error('Increment must be greater than 0');
      return;
    }
    if (needsCampus && !effectiveBranchId) {
      toast.error('Select a campus');
      return;
    }
    if (incrementScope === 'program' && !programId) {
      toast.error('Select a program');
      return;
    }
    if (incrementScope === 'batch' && !batchId) {
      toast.error('Select a batch');
      return;
    }
    if (incrementScope === 'student' && !studentId) {
      toast.error('Select a student');
      return;
    }
    previewMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <TrendingUp className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Fee increment</DialogTitle>
            <DialogDescription className="mt-1">
              Raise listed rates and unpaid invoices from the chosen month. Paid invoices stay.
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handlePreview}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div>
              <FormFieldLabel required>Scope</FormFieldLabel>
              <SelectDropdown
                aria-label="Increment scope"
                value={incrementScope}
                onValueChange={(next) => setIncrementScope(next as IncrementScope)}
                options={scopeOptions}
                className="w-full"
              />
            </div>

            {!branchId && needsCampus && (
              <BranchSelectField value={pickedBranchId} onValueChange={setPickedBranchId} />
            )}

            {incrementScope === 'program' && (
              <div>
                <FormFieldLabel required>Program</FormFieldLabel>
                <SelectDropdown
                  aria-label="Program"
                  placeholder={effectiveBranchId ? 'Select program' : 'Select campus first'}
                  disabled={!effectiveBranchId}
                  value={programId}
                  onValueChange={setProgramId}
                  options={[
                    { value: '', label: 'Select program' },
                    ...((programs?.data ?? []).map((p) => ({ value: p.id, label: p.name })) ),
                  ]}
                  className="w-full"
                />
              </div>
            )}

            {incrementScope === 'batch' && (
              <div>
                <FormFieldLabel required>Batch</FormFieldLabel>
                <SelectDropdown
                  aria-label="Batch"
                  placeholder={effectiveBranchId ? 'Select batch' : 'Select campus first'}
                  disabled={!effectiveBranchId}
                  value={batchId}
                  onValueChange={setBatchId}
                  options={[
                    { value: '', label: 'Select batch' },
                    ...((batchesData?.data ?? []).map((b) => ({ value: b.id, label: b.name })) ),
                  ]}
                  className="w-full"
                />
              </div>
            )}

            {incrementScope === 'student' && (
              <div>
                <FormFieldLabel required>Student</FormFieldLabel>
                <SelectDropdown
                  aria-label="Student"
                  placeholder={effectiveBranchId ? 'Select student' : 'Select campus first'}
                  disabled={!effectiveBranchId}
                  value={studentId}
                  onValueChange={setStudentId}
                  options={[
                    { value: '', label: 'Select student' },
                    ...((students?.data ?? []).map((s) => ({ value: s.id, label: s.fullName })) ),
                  ]}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  Sets a student monthly override. Batch-mates keep the listed structure.
                </p>
              </div>
            )}

            <div>
              <FormFieldLabel required>Fee type</FormFieldLabel>
              <SelectDropdown
                aria-label="Fee type"
                placeholder="Select fee type"
                value={feeTypeId}
                onValueChange={setFeeTypeId}
                options={[
                  { value: '', label: 'Select fee type' },
                  ...feeTypesList.map((f) => ({ value: f.id, label: f.name })),
                ]}
                className="w-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel required>Change</FormFieldLabel>
                <SelectDropdown
                  aria-label="Increment mode"
                  value={mode}
                  onValueChange={(next) => setMode(next as 'percent' | 'amount')}
                  options={[
                    { value: 'percent', label: 'Percent' },
                    { value: 'amount', label: 'Flat PKR' },
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <FormFieldLabel htmlFor="increment-value" required>
                  {mode === 'percent' ? 'Percent' : 'Amount (PKR)'}
                </FormFieldLabel>
                <input
                  id="increment-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={modalFieldClassName}
                />
              </div>
            </div>

            <div>
              <FormFieldLabel htmlFor="increment-from" required>
                Effective from
              </FormFieldLabel>
              <input
                id="increment-from"
                type="month"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className={modalFieldClassName}
              />
              <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                Unpaid invoices in this month and later are rewritten. Paid invoices are skipped.
              </p>
            </div>

            {preview && (
              <div className="rounded-xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-50)] px-4 py-3 text-sm">
                <p className="font-medium text-[var(--text-main-900)]">Preview</p>
                <p className="mt-1 text-[var(--text-sub-500)]">
                  {preview.structures} structure{preview.structures === 1 ? '' : 's'} ·{' '}
                  {preview.studentOverrides} student override{preview.studentOverrides === 1 ? '' : 's'} ·{' '}
                  {preview.unpaidInvoices} unpaid invoice{preview.unpaidInvoices === 1 ? '' : 's'}
                </p>
                {preview.samples.structures[0] ? (
                  <p className="mt-1 text-xs">Structure {sampleLabel(preview.samples.structures[0])}</p>
                ) : null}
                {preview.samples.overrides[0] ? (
                  <p className="mt-1 text-xs">Override {sampleLabel(preview.samples.overrides[0])}</p>
                ) : null}
                {preview.samples.invoices[0] ? (
                  <p className="mt-1 text-xs">Invoice {sampleLabel(preview.samples.invoices[0])}</p>
                ) : null}
              </div>
            )}
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
              disabled={previewMutation.isPending || applyMutation.isPending}
              className="rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm disabled:opacity-50"
            >
              {previewMutation.isPending ? 'Previewing…' : 'Preview'}
            </button>
            <button
              type="button"
              disabled={!preview || applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
              className={cn(
                'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {applyMutation.isPending ? 'Applying…' : 'Apply increment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
