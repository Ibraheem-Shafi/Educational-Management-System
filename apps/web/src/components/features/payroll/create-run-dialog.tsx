'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

export function CreateRunDialog({
  branchId,
  open,
  onOpenChange,
  onCreated,
}: {
  branchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (runId: string) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const now = new Date();

  const [form, setForm] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<{ id: string }>('/payroll/runs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId,
          year: Number(form.year),
          month: Number(form.month),
          notes: form.notes.trim() || null,
        }),
      }),
    onSuccess: async (run) => {
      toast.success('Payroll run created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
      onOpenChange(false);
      onCreated?.(run.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription className="mt-1">
              Create a draft run for a branch and period
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormFieldLabel label="Year" required />
              <input
                type="number"
                min={2000}
                max={2100}
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
            <div>
              <FormFieldLabel label="Month" required />
              <select
                value={form.month}
                onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
                className={modalFieldClassName}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <FormFieldLabel label="Notes" />
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className={cn(modalFieldClassName, 'resize-none')}
            />
          </div>
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className={cn(
              'w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2.5 text-sm font-medium text-white',
              createMutation.isPending && 'opacity-50',
            )}
          >
            {createMutation.isPending ? 'Creating…' : 'Create run'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
