'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSalaryStructureSchema,
  updateSalaryStructureSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
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
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } = useFormErrors(
    isEdit ? updateSalaryStructureSchema : createSalaryStructureSchema,
  );

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
      return;
    }
    setForm({
      userId: userId ?? '',
      basicSalary: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      isActive: true,
      components: [emptyComponent()],
    });
    clearAll();
  }, [open, structure, userId, clearAll]);

  const { data: users } = useQuery({
    queryKey: ['users-payroll', branchId],
    queryFn: () =>
      apiClient<PaginatedResponse<StaffOption>>(`/users?branchId=${branchId}&limit=100`, {
        token,
      }),
    enabled: !!token && open && !userId,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
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
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const staffOptions = (users?.data ?? []).map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.staffCode})`,
  }));

  function buildPayload() {
    const components = form.components
      .filter((c) => c.name.trim())
      .map((c) => ({
        kind: c.kind,
        name: c.name.trim(),
        amount: Number(c.amount) || 0,
        percentOfBasic:
          c.percentOfBasic != null && c.percentOfBasic !== ('' as unknown as number)
            ? Number(c.percentOfBasic)
            : null,
      }));

    if (isEdit) {
      return {
        basicSalary: Number(form.basicSalary),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        components,
      };
    }

    return {
      userId: form.userId,
      branchId,
      basicSalary: Number(form.basicSalary),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      isActive: form.isActive,
      components,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    saveMutation.mutate(payload);
  }

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

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {!isEdit && !userId && (
            <div>
              <FormFieldLabel label="Staff member" required />
              <SelectDropdown
                aria-label="Staff member"
                placeholder="Select staff"
                value={form.userId}
                onValueChange={(value) => {
                  clearField('userId');
                  setForm((prev) => ({ ...prev, userId: value }));
                }}
                options={staffOptions}
                className={fieldClassName('userId', modalFieldClassName)}
              />
              <FormFieldError message={errors.userId} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormFieldLabel label="Basic salary (PKR)" required />
              <input
                type="number"
                min={0}
                value={form.basicSalary}
                onChange={(e) => {
                  clearField('basicSalary');
                  setForm((prev) => ({ ...prev, basicSalary: e.target.value }));
                }}
                className={fieldClassName('basicSalary', modalFieldClassName)}
              />
              <FormFieldError message={errors.basicSalary} />
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
                onChange={(e) => {
                  clearField('effectiveFrom');
                  setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }));
                }}
                className={fieldClassName('effectiveFrom', modalFieldClassName)}
              />
              <FormFieldError message={errors.effectiveFrom} />
            </div>
            <div>
              <FormFieldLabel label="Effective to" />
              <input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => {
                  clearField('effectiveTo');
                  setForm((prev) => ({ ...prev, effectiveTo: e.target.value }));
                }}
                className={fieldClassName('effectiveTo', modalFieldClassName)}
              />
              <FormFieldError message={errors.effectiveTo} />
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
            <FormFieldError message={errors.components} />
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
                      onValueChange={(value) => {
                        clearField(`components.${index}.kind`);
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, kind: value as 'allowance' | 'deduction' } : c,
                          ),
                        }));
                      }}
                      options={[
                        { value: 'allowance', label: 'Allowance' },
                        { value: 'deduction', label: 'Deduction' },
                      ]}
                      className={fieldClassName(`components.${index}.kind`, modalFieldClassName)}
                    />
                    <input
                      placeholder="Name"
                      value={component.name}
                      onChange={(e) => {
                        clearField(`components.${index}.name`);
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, name: e.target.value } : c,
                          ),
                        }));
                      }}
                      className={fieldClassName(`components.${index}.name`, modalFieldClassName)}
                    />
                  </div>
                  <FormFieldError message={errors[`components.${index}.kind`]} />
                  <FormFieldError message={errors[`components.${index}.name`]} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Fixed amount"
                      value={component.amount || ''}
                      onChange={(e) => {
                        clearField(`components.${index}.amount`);
                        setForm((prev) => ({
                          ...prev,
                          components: prev.components.map((c, i) =>
                            i === index ? { ...c, amount: Number(e.target.value) || 0 } : c,
                          ),
                        }));
                      }}
                      className={fieldClassName(`components.${index}.amount`, modalFieldClassName)}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="% of basic (optional)"
                      value={component.percentOfBasic ?? ''}
                      onChange={(e) => {
                        clearField(`components.${index}.percentOfBasic`);
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
                        }));
                      }}
                      className={fieldClassName(
                        `components.${index}.percentOfBasic`,
                        modalFieldClassName,
                      )}
                    />
                  </div>
                  <FormFieldError message={errors[`components.${index}.amount`]} />
                  <FormFieldError message={errors[`components.${index}.percentOfBasic`]} />
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
            type="submit"
            disabled={saveMutation.isPending}
            className={cn(
              'w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2.5 text-sm font-medium text-white',
              saveMutation.isPending && 'opacity-50',
            )}
          >
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update structure' : 'Create structure'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
