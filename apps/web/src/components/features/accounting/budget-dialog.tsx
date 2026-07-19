'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PieChart, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createBudgetSchema, updateBudgetSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AccountingAccount, Budget } from './types';

type LineForm = { accountId: string; amount: string };

const emptyLine = (): LineForm => ({ accountId: '', amount: '' });

export function BudgetDialog({
  open,
  onOpenChange,
  branchId,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  budget: Budget | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = !!budget;
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } = useFormErrors(
    isEdit ? updateBudgetSchema : createBudgetSchema,
  );

  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accountingAccounts(branchId),
    queryFn: () =>
      apiClient<{ data: AccountingAccount[] }>(
        `/accounting/accounts?branchId=${branchId}&activeOnly=true&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId && open,
  });

  const accountOptions = useMemo(
    () =>
      (accountsData?.data ?? []).map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
      })),
    [accountsData],
  );

  useEffect(() => {
    if (!open) return;
    if (budget) {
      setName(budget.name);
      setYear(String(budget.year));
      setLines(
        budget.lines.map((line) => ({
          accountId: line.accountId,
          amount: String(line.amount),
        })),
      );
      return;
    }
    setName('');
    setYear(String(new Date().getFullYear()));
    setLines([emptyLine()]);
    clearAll();
  }, [open, budget, clearAll]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isEdit) {
        return apiClient(`/accounting/budgets/${budget!.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }
      return apiClient('/accounting/budgets', { method: 'POST', token, body: payload });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Budget updated' : 'Budget created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingBudgets(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function buildPayload() {
    const linePayload = lines.map((line) => ({
      accountId: line.accountId,
      amount: Number(line.amount) || 0,
    }));
    if (isEdit) {
      return {
        name: name.trim(),
        year: Number(year),
        lines: linePayload,
      };
    }
    return {
      branchId,
      name: name.trim(),
      year: Number(year),
      lines: linePayload,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-icon-primary" />
            <DialogTitle className="text-base font-medium">
              {isEdit ? 'Edit budget' : 'Add budget'}
            </DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5 text-icon-primary" />
          </button>
        </div>
        <DialogDescription className="sr-only">Budget planning form</DialogDescription>

        <form className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormFieldLabel htmlFor="budget-name">Name</FormFieldLabel>
              <input
                id="budget-name"
                className={fieldClassName('name', modalFieldClassName)}
                value={name}
                onChange={(e) => {
                  clearField('name');
                  setName(e.target.value);
                }}
                placeholder="Annual operating budget"
              />
              <FormFieldError message={errors.name} />
            </div>
            <div>
              <FormFieldLabel htmlFor="budget-year">Year</FormFieldLabel>
              <input
                id="budget-year"
                type="number"
                className={fieldClassName('year', modalFieldClassName)}
                value={year}
                onChange={(e) => {
                  clearField('year');
                  setYear(e.target.value);
                }}
              />
              <FormFieldError message={errors.year} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormFieldLabel>Budget lines</FormFieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add line
              </Button>
            </div>
            <FormFieldError message={errors.lines} />

            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-stroke-soft-200 p-3 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <SelectDropdown
                    aria-label={`Budget account line ${index + 1}`}
                    placeholder="Select account"
                    value={line.accountId}
                    onValueChange={(value) => {
                      clearField(`lines.${index}.accountId`);
                      setLines((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, accountId: value } : item)),
                      );
                    }}
                    options={accountOptions}
                    className={fieldClassName(`lines.${index}.accountId`, 'w-full')}
                  />
                  <FormFieldError message={errors[`lines.${index}.accountId`]} />
                </div>
                <div className="sm:col-span-3">
                  <input
                    className={fieldClassName(`lines.${index}.amount`, modalFieldClassName)}
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(e) => {
                      clearField(`lines.${index}.amount`);
                      setLines((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)),
                      );
                    }}
                  />
                  <FormFieldError message={errors[`lines.${index}.amount`]} />
                </div>
                {lines.length > 1 ? (
                  <div className="flex items-center justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove line"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              'w-full rounded-lg bg-primary-base px-4 py-2.5 text-sm font-medium text-neutral-0',
              mutation.isPending && 'opacity-60',
            )}
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create budget'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
