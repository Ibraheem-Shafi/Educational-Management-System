'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { BranchFormFields } from '@/components/features/branches/branch-form-fields';
import {
  buildBranchPhonePayload,
  emptyBranchForm,
  slugifyBranchCode,
  type BranchFormValues,
} from '@/lib/branch-form';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function AddBranchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BranchFormValues>(emptyBranchForm);

  useEffect(() => {
    if (!open) setForm(emptyBranchForm);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (payload: BranchFormValues) => {
      const fullPhone = buildBranchPhonePayload(payload);
      const code = payload.code.trim() || slugifyBranchCode(payload.name);

      return apiClient('/branches', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: payload.name.trim(),
          code,
          ...(payload.address.trim() ? { address: payload.address.trim() } : {}),
          ...(payload.email.trim() ? { email: payload.email.trim() } : {}),
          ...(fullPhone ? { phone: fullPhone } : {}),
        }),
      });
    },
    onSuccess: () => {
      toast.success('Branch created');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branchesStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create branch'),
  });

  const update = (key: keyof BranchFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = form.name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] gap-0 p-0"
        aria-describedby={undefined}
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Building2 className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription className="mt-1">
              Enter the details to add new branch
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

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            const code = form.code.trim() || slugifyBranchCode(form.name);
            if (!form.name.trim() || code.length < 2) {
              toast.error('Enter a valid branch name');
              return;
            }
            createMutation.mutate({ ...form, code });
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
            <BranchFormFields form={form} onChange={update} autoCode />
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]',
                'shadow-[0px_1px_2px_rgba(82,88,102,0.06)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white',
                'shadow-[0px_1px_2px_rgba(55,93,251,0.08)] hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending ? 'Adding…' : 'Add Branch'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
