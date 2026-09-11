'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { type AnnualChargeMode, type BranchScope } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { withBranchScope } from '@/lib/branch-scope';
import { useStudentsOptions } from '@/hooks/use-students-options';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { DateField } from '@/components/ui/date-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export const ANNUAL_CHARGE_MODE_OPTIONS: Array<{ value: AnnualChargeMode; label: string }> = [
  { value: 'full', label: 'Charge in full' },
  { value: 'installments', label: 'Monthly installments' },
  { value: 'waived', label: 'Waive annual charges' },
  { value: 'deferred', label: 'Defer until a date' },
];

type StudentPolicy = {
  id: string;
  fullName: string;
  monthlyFeeDiscount?: number | null;
  monthlyFeeWaived?: boolean;
  annualChargeMode?: AnnualChargeMode | string;
  annualDeferredUntil?: string | null;
  annualInstallmentCount?: number;
};

export function StudentFeePolicyDialog({
  open,
  onOpenChange,
  branchId,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  scope: BranchScope;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [pickedBranchId, setPickedBranchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [monthlyFeeDiscount, setMonthlyFeeDiscount] = useState('');
  const [monthlyFeeWaived, setMonthlyFeeWaived] = useState(false);
  const [annualChargeMode, setAnnualChargeMode] = useState<AnnualChargeMode>('full');
  const [annualDeferredUntil, setAnnualDeferredUntil] = useState('');
  const [annualInstallmentCount, setAnnualInstallmentCount] = useState('12');

  const effectiveBranchId = branchId || pickedBranchId;
  const { data: students } = useStudentsOptions(token, effectiveBranchId, open && !!effectiveBranchId);

  const { data: student } = useQuery({
    queryKey: ['student-fee-policy', studentId],
    queryFn: () =>
      apiClient<StudentPolicy>(withBranchScope(`/students/${studentId}`, scope), { token }),
    enabled: !!token && open && !!studentId,
  });

  useEffect(() => {
    if (!open) {
      setPickedBranchId('');
      setStudentId('');
      setMonthlyFeeDiscount('');
      setMonthlyFeeWaived(false);
      setAnnualChargeMode('full');
      setAnnualDeferredUntil('');
      setAnnualInstallmentCount('12');
    }
  }, [open]);

  useEffect(() => {
    setStudentId('');
  }, [effectiveBranchId]);

  useEffect(() => {
    if (!student) return;
    setMonthlyFeeDiscount(
      student.monthlyFeeDiscount && student.monthlyFeeDiscount > 0
        ? String(student.monthlyFeeDiscount)
        : '',
    );
    setMonthlyFeeWaived(Boolean(student.monthlyFeeWaived));
    setAnnualChargeMode((student.annualChargeMode as AnnualChargeMode) || 'full');
    setAnnualDeferredUntil(student.annualDeferredUntil?.slice(0, 10) ?? '');
    setAnnualInstallmentCount(String(student.annualInstallmentCount ?? 12));
  }, [student]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient(withBranchScope(`/students/${studentId}/fee-policy`, scope), {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          monthlyFeeDiscount: monthlyFeeDiscount.trim() === '' ? 0 : Number(monthlyFeeDiscount),
          monthlyFeeWaived,
          annualChargeMode,
          annualDeferredUntil:
            annualChargeMode === 'deferred' ? annualDeferredUntil || null : null,
          annualInstallmentCount: Number(annualInstallmentCount) || 12,
        }),
      }),
    onSuccess: () => {
      toast.success('Student fee policy saved');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-policy', studentId] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      toast.error('Select a student');
      return;
    }
    if (
      monthlyFeeDiscount.trim() !== '' &&
      (Number.isNaN(Number(monthlyFeeDiscount)) || Number(monthlyFeeDiscount) < 0)
    ) {
      toast.error('Enter a valid discount amount');
      return;
    }
    if (annualChargeMode === 'deferred' && !/^\d{4}-\d{2}-\d{2}$/.test(annualDeferredUntil)) {
      toast.error('Defer until date is required');
      return;
    }
    const count = Number(annualInstallmentCount);
    if (!Number.isInteger(count) || count < 1 || count > 24) {
      toast.error('Installment count must be between 1 and 24');
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <UserRoundCog className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Student fee</DialogTitle>
            <DialogDescription className="mt-1">
              Monthly discount, ongoing waive, and annual charge policy
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {!branchId && (
              <BranchSelectField value={pickedBranchId} onValueChange={setPickedBranchId} />
            )}

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
            </div>

            <div>
              <FormFieldLabel htmlFor="policy-discount">Monthly fee discount (Rs)</FormFieldLabel>
              <input
                id="policy-discount"
                type="number"
                min={0}
                step="1"
                className={modalFieldClassName}
                placeholder="e.g. 2000"
                value={monthlyFeeDiscount}
                onChange={(e) => setMonthlyFeeDiscount(e.target.value)}
                disabled={!studentId}
              />
              <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                Fixed amount off monthly tuition. Cascades to future unpaid monthly invoices.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
              <input
                type="checkbox"
                checked={monthlyFeeWaived}
                onChange={(e) => setMonthlyFeeWaived(e.target.checked)}
                disabled={!studentId}
              />
              Waive monthly fee (new monthly invoices are net 0)
            </label>

            <div>
              <FormFieldLabel required>Annual charges</FormFieldLabel>
              <SelectDropdown
                aria-label="Annual charges"
                value={annualChargeMode}
                onValueChange={(next) => setAnnualChargeMode(next as AnnualChargeMode)}
                options={ANNUAL_CHARGE_MODE_OPTIONS}
                className="w-full"
                disabled={!studentId}
              />
            </div>

            {annualChargeMode === 'installments' && (
              <div>
                <FormFieldLabel htmlFor="policy-installments">Installment count</FormFieldLabel>
                <input
                  id="policy-installments"
                  type="number"
                  min={1}
                  max={24}
                  className={modalFieldClassName}
                  value={annualInstallmentCount}
                  onChange={(e) => setAnnualInstallmentCount(e.target.value)}
                  disabled={!studentId}
                />
              </div>
            )}

            {annualChargeMode === 'deferred' && (
              <div>
                <FormFieldLabel htmlFor="policy-defer" required>
                  Defer until
                </FormFieldLabel>
                <DateField
                  id="policy-defer"
                  value={annualDeferredUntil}
                  onValueChange={setAnnualDeferredUntil}
                  className={modalFieldClassName}
                  disabled={!studentId}
                />
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
              disabled={!studentId || saveMutation.isPending}
              className={cn(
                'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save policy'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
