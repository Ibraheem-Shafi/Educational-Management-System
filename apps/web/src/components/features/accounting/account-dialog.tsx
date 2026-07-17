'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, X } from 'lucide-react';
import { toast } from 'sonner';
import { accountTypes } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { cn } from '@/lib/utils';
import type { AccountingAccount } from './types';
import { formatLabel } from './types';

const emptyForm = {
  code: '',
  name: '',
  type: 'asset',
};

export function AccountDialog({
  open,
  onOpenChange,
  branchId,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  account: AccountingAccount | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!account;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }
    if (account) {
      setForm({ code: account.code, name: account.name, type: account.type });
    }
  }, [open, account]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim()) {
        throw new Error('Code and name are required');
      }
      const payload = {
        branchId,
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
      };
      if (isEdit) {
        return apiClient(`/accounting/accounts/${account!.id}`, {
          method: 'PATCH',
          token,
          body: { name: payload.name, type: payload.type },
        });
      }
      return apiClient('/accounting/accounts', { method: 'POST', token, body: payload });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Account updated' : 'Account created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts(branchId) });
      onOpenChange(false);
    },
    onError: () => toast.error(isEdit ? 'Unable to update account' : 'Unable to create account'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-icon-primary" />
            <DialogTitle className="text-base font-medium">
              {isEdit ? 'Edit account' : 'Add account'}
            </DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5 text-icon-primary" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          {isEdit ? 'Update chart of accounts entry' : 'Create a new chart of accounts entry'}
        </DialogDescription>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <FormFieldLabel htmlFor="account-code">Code</FormFieldLabel>
            <input
              id="account-code"
              className={modalFieldClassName}
              value={form.code}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. 1100"
            />
          </div>
          <div>
            <FormFieldLabel htmlFor="account-name">Name</FormFieldLabel>
            <input
              id="account-name"
              className={modalFieldClassName}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Account name"
            />
          </div>
          <div>
            <FormFieldLabel htmlFor="account-type">Type</FormFieldLabel>
            <SelectDropdown
              aria-label="Account type"
              value={form.type}
              onValueChange={(value) => setForm((f) => ({ ...f, type: value }))}
              options={accountTypes.map((t) => ({ value: t, label: formatLabel(t) }))}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              'w-full rounded-lg bg-primary-base px-4 py-2.5 text-sm font-medium text-neutral-0',
              mutation.isPending && 'opacity-60',
            )}
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
