'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, X } from 'lucide-react';
import { updateBranchSchema } from '@eims/shared';
import { toast } from 'sonner';
import type { BranchDetailResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
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
  parsePhoneForBranchForm,
  type BranchFormValues,
} from '@/lib/branch-form';
import { useFormErrors } from '@/hooks/use-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

function branchToForm(branch: BranchDetailResponse): BranchFormValues {
  const { phoneCountryCode, phone } = parsePhoneForBranchForm(branch.phone);
  return {
    name: branch.name,
    code: branch.code,
    address: branch.address ?? branch.addressLabel,
    email: branch.email ?? '',
    phoneCountryCode,
    phone,
  };
}

function branchFormToUpdatePayload(form: BranchFormValues) {
  const phone = buildBranchPhonePayload(form);
  return {
    name: form.name.trim(),
    address: form.address.trim() || undefined,
    email: form.email.trim() || undefined,
    ...(phone ? { phone } : {}),
  };
}

export function EditBranchDialog({
  branchId,
  open,
  onOpenChange,
}: {
  branchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BranchFormValues>(emptyBranchForm);
  const { errors, clearField, validate, applyApiErrors, fieldClassName, clearAll } =
    useFormErrors(updateBranchSchema);

  const { data: branch, isLoading } = useQuery({
    queryKey: queryKeys.branchDetail(branchId ?? ''),
    queryFn: () => apiClient<BranchDetailResponse>(`/branches/${branchId}`, { token }),
    enabled: !!token && !!branchId && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyBranchForm);
      clearAll();
      return;
    }
    if (branch) setForm(branchToForm(branch));
  }, [open, branch, clearAll]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof branchFormToUpdatePayload>) =>
      apiClient(`/branches/${branchId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Branch updated');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branchesStats });
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.branchDetail(branchId) });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Failed to update branch');
    },
  });

  const update = (key: keyof BranchFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription className="mt-1">
              Update the details for this branch
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
            const payload = branchFormToUpdatePayload(form);
            if (!validate(payload)) return;
            updateMutation.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-[10px] bg-[var(--neutral-50)]" />
                ))}
              </div>
            ) : (
              <BranchFormFields
                form={form}
                onChange={update}
                errors={errors}
                fieldClassName={fieldClassName}
                clearField={clearField}
              />
            )}
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
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
              disabled={updateMutation.isPending || isLoading}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white',
                'shadow-[0px_1px_2px_rgba(55,93,251,0.08)] hover:opacity-90 disabled:opacity-50',
              )}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
