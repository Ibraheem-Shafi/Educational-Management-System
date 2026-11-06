'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { canSelectAllBranches, createStaffUserSchema, normalizePakistanPhone } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { PakistanPhoneInput } from '@/components/ui/pakistan-phone-input';
import { inviteFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
  code?: string;
}

interface BranchOption {
  id: string;
  name: string;
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
      {children}
      {required && <span className="text-[#DF1C41]"> *</span>}
    </label>
  );
}

const emptyForm = {
  fullName: '',
  phone: '',
  password: '',
  email: '',
  roleId: '',
  branchId: '',
  designation: '',
};

export function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors, setFieldError } =
    useFormErrors(createStaffUserSchema);

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient<{ data: Role[] }>('/users/roles', { token }),
    enabled: !!token && open,
  });

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: BranchOption[] }>('/branches/options', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
    }
  }, [open, clearAll]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient<{ message: string }>('/users', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'User created');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.usersStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedRole = roles?.data.find((role) => role.id === form.roleId);
  const allBranchesAllowed = canSelectAllBranches(selectedRole?.code ? [selectedRole.code] : []);
  const canSubmit = Boolean(
    form.fullName.trim() &&
      form.password.trim().length >= 8 &&
      form.roleId &&
      (form.email.trim() || form.phone.trim()) &&
      (allBranchesAllowed || form.branchId),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allBranchesAllowed && !form.branchId) {
      setFieldError('branchId', 'Select a campus for this role');
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setFieldError('email', 'Enter an email or a phone number');
      return;
    }
    const payload = {
      fullName: form.fullName.trim(),
      password: form.password,
      roleId: form.roleId,
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.phone.trim() ? { phone: normalizePakistanPhone(form.phone.trim()) } : {}),
      ...(form.branchId ? { branchId: form.branchId } : {}),
      ...(form.designation.trim() ? { designation: form.designation.trim() } : {}),
    };
    if (!validate(payload)) return;
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-4 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
              <UserPlus className="h-[18px] w-[18px] text-[var(--text-main-900)]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription className="mt-1">
                Create an active account now. Email and phone are both optional — either one is
                enough to sign in, and you can store both.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div>
              <FieldLabel required>Full name</FieldLabel>
              <input
                className={fieldClassName('fullName', inviteFieldClassName)}
                placeholder="e.g., Ayesha Khan"
                value={form.fullName}
                onChange={(e) => {
                  update('fullName', e.target.value);
                  clearField('fullName');
                }}
              />
              <FormFieldError message={errors.fullName} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  className={fieldClassName('email', inviteFieldClassName)}
                  placeholder="name@school.edu.pk"
                  value={form.email}
                  onChange={(e) => {
                    update('email', e.target.value);
                    clearField('email');
                  }}
                />
                <FormFieldError message={errors.email} />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <PakistanPhoneInput
                  value={form.phone}
                  onChange={(value) => {
                    update('phone', value);
                    clearField('phone');
                    clearField('email');
                  }}
                  className={errors.phone ? 'border-red-500' : undefined}
                />
                <FormFieldError message={errors.phone} />
              </div>
            </div>
            <p className="text-xs text-[var(--text-sub-500,#525866)]">
              Enter an email, a phone number, or both. A phone-only account can still sign in with
              that phone.
            </p>

            <div>
              <FieldLabel required>Password</FieldLabel>
              <input
                type="text"
                autoComplete="new-password"
                className={fieldClassName('password', inviteFieldClassName)}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => {
                  update('password', e.target.value);
                  clearField('password');
                }}
              />
              <FormFieldError message={errors.password} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Select Role</FieldLabel>
                <SelectDropdown
                  aria-label="Select role"
                  placeholder="Select Role"
                  value={form.roleId}
                  onValueChange={(value) => {
                    update('roleId', value);
                    clearField('roleId');
                  }}
                  options={[
                    { value: '', label: 'Select Role' },
                    ...(roles?.data.map((role) => ({ value: role.id, label: role.name })) ?? []),
                  ]}
                  className="w-full"
                />
                <FormFieldError message={errors.roleId} />
              </div>
              <div>
                <FieldLabel required={!allBranchesAllowed}>Campus</FieldLabel>
                <SelectDropdown
                  aria-label="Select campus"
                  placeholder="All branches"
                  value={form.branchId}
                  onValueChange={(value) => {
                    update('branchId', value);
                    clearField('branchId');
                  }}
                  options={[
                    { value: '', label: 'All branches' },
                    ...(branches?.data.map((branch) => ({
                      value: branch.id,
                      label: branch.name,
                    })) ?? []),
                  ]}
                  className="w-full"
                />
                <FormFieldError message={errors.branchId} />
              </div>
            </div>

            <div>
              <FieldLabel>Designation</FieldLabel>
              <input
                className={fieldClassName('designation', inviteFieldClassName)}
                placeholder="e.g., Teacher, Accountant"
                value={form.designation}
                onChange={(e) => {
                  update('designation', e.target.value);
                  clearField('designation');
                }}
              />
              <FormFieldError message={errors.designation} />
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
