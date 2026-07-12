'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SquarePen, X } from 'lucide-react';
import { toast } from 'sonner';
import { CNIC_REGEX } from '@eims/shared';
import type { UserDetailResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import {
  FormFieldLabel,
  InvitePhoneField,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

type EditForm = {
  fullName: string;
  phoneCountryCode: string;
  phone: string;
  gender: string;
  cnic: string;
};

function emptyForm(): EditForm {
  return {
    fullName: '',
    phoneCountryCode: '+92',
    phone: '',
    gender: '',
    cnic: '',
  };
}

function parsePhone(raw: string | null): { phoneCountryCode: string; phone: string } {
  if (!raw) return { phoneCountryCode: '+92', phone: '' };
  const match = raw.match(/^(\+\d{1,3})\s*(.*)$/);
  if (match) {
    return { phoneCountryCode: match[1], phone: match[2].replace(/\D/g, '') };
  }
  return { phoneCountryCode: '+92', phone: raw.replace(/\D/g, '') };
}

function userToForm(user: UserDetailResponse): EditForm {
  const { phoneCountryCode, phone } = parsePhone(user.phone);
  return {
    fullName: user.fullName,
    phoneCountryCode,
    phone,
    gender: user.gender ?? '',
    cnic: user.cnic ?? '',
  };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <FormFieldLabel required={required}>{label}</FormFieldLabel>
      {children}
    </div>
  );
}

export function EditUserDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditForm>(emptyForm);

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.userDetail(userId ?? ''),
    queryFn: () => apiClient<UserDetailResponse>(`/users/${userId}`, { token }),
    enabled: !!token && !!userId && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (user) setForm(userToForm(user));
  }, [open, user]);

  const updateMutation = useMutation({
    mutationFn: (payload: EditForm) => {
      const phoneDigits = payload.phone.replace(/\D/g, '');
      const fullPhone = phoneDigits
        ? `${payload.phoneCountryCode}${phoneDigits}`
        : null;
      const cnic = payload.cnic.trim() || null;
      if (cnic && !CNIC_REGEX.test(cnic)) {
        throw new Error('CNIC must be in format 12345-1234567-1');
      }
      return apiClient(`/users/${userId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          fullName: payload.fullName.trim(),
          phone: fullPhone,
          gender: payload.gender || undefined,
          cnic,
        }),
      });
    },
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.usersStats });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId) });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update user'),
  });

  const update = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = form.fullName.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] gap-0 p-0"
        aria-describedby={undefined}
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <SquarePen className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription className="mt-1">
              Update profile details for this staff member
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
            if (!canSubmit) {
              toast.error('Enter a valid full name');
              return;
            }
            updateMutation.mutate(form);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-[10px] bg-[var(--neutral-50)]" />
                ))}
              </div>
            ) : (
              <>
                <Field label="Email">
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className={cn(modalFieldClassName, 'bg-[var(--neutral-50)] text-[var(--text-sub-500)]')}
                  />
                </Field>
                <Field label="Full name" required>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => update('fullName', e.target.value)}
                    className={modalFieldClassName}
                    required
                  />
                </Field>
                <InvitePhoneField
                  value={form.phone}
                  countryCode={form.phoneCountryCode}
                  onChange={(value) => update('phone', value)}
                  onCountryCodeChange={(code) => update('phoneCountryCode', code)}
                />
                <Field label="Gender">
                  <SelectDropdown
                    aria-label="Gender"
                    placeholder="Select gender"
                    value={form.gender}
                    onValueChange={(value) => update('gender', value)}
                    options={GENDER_OPTIONS}
                    fullWidth
                  />
                </Field>
                <Field label="CNIC">
                  <input
                    type="text"
                    value={form.cnic}
                    onChange={(e) => update('cnic', e.target.value)}
                    placeholder="12345-1234567-1"
                    className={modalFieldClassName}
                  />
                </Field>
                {user?.roles[0] && (
                  <Field label="Role">
                    <input
                      type="text"
                      value={user.roles.map((r) => r.name).join(', ')}
                      disabled
                      className={cn(modalFieldClassName, 'bg-[var(--neutral-50)] text-[var(--text-sub-500)]')}
                    />
                  </Field>
                )}
                <Field label="Branch">
                  <input
                    type="text"
                    value={user?.branch?.name ?? 'All branches'}
                    disabled
                    className={cn(modalFieldClassName, 'bg-[var(--neutral-50)] text-[var(--text-sub-500)]')}
                  />
                </Field>
              </>
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
              disabled={updateMutation.isPending || isLoading || !canSubmit}
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
