'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { SalaryComponent, SalaryStructure } from './types';

interface StaffOption {
  id: string;
  fullName: string;
  staffCode: string;
}

const emptyComponent = (): SalaryComponent => ({
  kind: 'allowance',
  name: '',
  amount: 0,
  percentOfBasic: null,
});

export function StructureDialog({
  branchId,
  userId,
  structure,
  open,
  onOpenChange,
}: {
  branchId: string;
  userId?: string;
  structure?: SalaryStructure;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = !!structure;

  const [form, setForm] = useState({
    userId: userId ?? '',
    basicSalary: '',
    effectiveFrom: '',
    effectiveTo: '',
    isActive: true,
    components: [emptyComponent()] as SalaryComponent[],
  });

  useEffect(() => {
    if (!open) return;
    if (structure) {
      setForm({
        userId: structure.userId,
        basicSalary: String(structure.basicSalary),
        effectiveFrom: structure.effectiveFrom,
        effectiveTo: structure.effectiveTo ?? '',
        isActive: structure.isActive,
        components:
          structure.components.length > 0
            ? structure.components.map((c) => ({
                kind: c.kind,
                name: c.name,
                amount: c.amount,
                percentOfBasic: c.percentOfBasic,
              }))
            : [emptyComponent()],
      });
    } else {
      setForm({
        userId: userId ?? '',
        basicSalary: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: '',
        isActive: true,
        components: [emptyComponent()],
      });
    }
  }, [open, structure, userId]);

  const { data: users } = useQuery({
    queryKey: ['users-payroll', branchId],
    queryFn: () =>
      apiClient<PaginatedResponse<StaffOption>>(`/users?branchId=${branchId}&limit=100`, {
        token,
      }),
    enabled: !!token && open && !userId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...(isEdit ? {} : { userId: form.userId, branchId }),
        basicSalary: Number(form.basicSalary),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        components: form.components
          .filter((c) => c.name.trim())
          .map((c) => ({
            kind: c.kind,
            name: c.name.trim(),
            amount: Number(c.amount) || 0,
            percentOfBasic:
              c.percentOfBasic != null && c.percentOfBasic !== ('' as unknown as number)
                ? Number(c.percentOfBasic)
                : null,
          })),
      };

      if (isEdit && structure) {
        return apiClient(`/payroll/structures/${structure.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
      }

      return apiClient('/payroll/structures', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Structure updated' : 'Structure created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollStructures(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const staffOptions = (users?.data ?? []).map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.staffCode})`,
  }));

  const canSubmit = form.basicSalary && form.effectiveFrom && (isEdit || form.userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>{isEdit ? 'Edit salary structure' : 'Add salary structure'}</DialogTitle>
            <DialogDescription className="mt-1">
              Define basic salary and allowance/deduction components
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
          {!isEdit && !userId && (
            <div>
              <FormFieldLabel label="Staff member" required />
              <SelectDropdown
                aria-label="Staff member"
                placeholder="Select staff"
                value={form.userId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, userId: value }))}
                options={staffOptions}
                className={modalFieldClassName}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormFieldLabel label="Basic salary (PKR)" required />
              <input
                type="number"
                min={0}
                value={form.basicSalary}
                onChange={(e) => setForm((prev) => ({ ...prev, basicSalary: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
            <div>
              <FormFieldLabel label="Status" />
              <SelectDropdown
                aria-label="Status"
                value={form.isActive ? 'true' : 'false'}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, isActive: value === 'true' }))
                }
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
                className={modalFieldClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormFieldLabel label="Effective from" required />
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
            <div>
              <FormFieldLabel label="Effective to" />
              <input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <FormFieldLabel label="Components" />
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    components: [...prev.components, emptyComponent()],
                  }))
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--midnight-blue-950,#01366C)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="space-y-3">
              {form.components.map((component, index) => (
                <div
                  key={index}
                  className="rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] p-3"
                >
                  <div className="mb-2 grid gap-2 sm:grid-cols-2">
                    <SelectDropdown
                      aria-label="Component kind"
                      value={component.kind}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, kind: value as 'allowance' | 'deduction' } : c,
                          ),
                        }))
                      }
                      options={[
                        { value: 'allowance', label: 'Allowance' },
                        { value: 'deduction', label: 'Deduction' },
                      ]}
                      className={modalFieldClassName}
                    />
                    <input
                      placeholder="Name"
                      value={component.name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, name: e.target.value } : c,
                          ),
                        }))
                      }
                      className={modalFieldClassName}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Fixed amount"
                      value={component.amount || ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, amount: Number(e.target.value) || 0 } : c,
                          ),
                        }))
                      }
                      className={modalFieldClassName}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="% of basic (optional)"
                      value={component.percentOfBasic ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index
                              ? {
                                  ...c,
                                  percentOfBasic: e.target.value ? Number(e.target.value) : null,
                                }
                              : c,
                          ),
                        }))
                      }
                      className={modalFieldClassName}
                    />
                  </div>
                  {form.components.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.filter((_, i) => i !== index),
                        }))
                      }
                      className="mt-2 inline-flex items-center gap-1 text-xs text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!canSubmit || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={cn(
              'w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2.5 text-sm font-medium text-white',
              (!canSubmit || saveMutation.isPending) && 'opacity-50',
            )}
          >
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update structure' : 'Create structure'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
