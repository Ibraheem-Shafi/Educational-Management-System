'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { PayrollLine } from './types';

export function AdjustLineDialog({
  branchId,
  line,
  open,
  onOpenChange,
}: {
  branchId: string;
  line: PayrollLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [adjustmentsTotal, setAdjustmentsTotal] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (line && open) {
      setAdjustmentsTotal(String(line.adjustmentsTotal ?? 0));
      setReason('');
    }
  }, [line, open]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!line) throw new Error('No line selected');
      return apiClient(`/payroll/lines/${line.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          adjustmentsTotal: Number(adjustmentsTotal) || 0,
          reason: reason.trim() || null,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Adjustment saved');
      if (line) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRun(line.runId) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>Adjust payroll line</DialogTitle>
            <DialogDescription className="mt-1">
              {line?.user?.fullName ?? 'Staff member'} — add bonus or deduction adjustment
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-neutral-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <FormFieldLabel label="Adjustment amount (PKR)" required />
            <input
              type="number"
              value={adjustmentsTotal}
              onChange={(e) => setAdjustmentsTotal(e.target.value)}
              className={modalFieldClassName}
              placeholder="Positive for bonus, negative for deduction"
            />
          </div>
          <div>
            <FormFieldLabel label="Reason" />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className={cn(modalFieldClassName, 'resize-none')}
            />
          </div>
          <button
            type="button"
            disabled={saveMutation.isPending || !line}
            onClick={() => saveMutation.mutate()}
            className={cn(
              'w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2.5 text-sm font-medium text-white',
              saveMutation.isPending && 'opacity-50',
            )}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save adjustment'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
