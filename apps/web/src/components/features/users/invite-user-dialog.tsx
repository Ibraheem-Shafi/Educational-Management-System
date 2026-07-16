'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
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
  InvitePhoneField,
  inviteFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
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
  email: '',
  phoneCountryCode: '+92',
  phone: '',
  address: '',
  cnic: '',
  gender: '',
  roleId: '',
  branchId: '',
};

export function InviteUserDialog({
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

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient<{ data: Role[] }>('/users/roles', { token }),
    enabled: !!token && open,
  });

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: BranchOption[] }>('/branches', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) setForm(emptyForm);
  }, [open]);

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiClient<{ token: string }>('/users/invitations', {
        method: 'POST',
        token,
        body: JSON.stringify({
          email: form.email,
          roleId: form.roleId,
          ...(form.branchId ? { branchId: form.branchId } : {}),
        }),
      }),
    onSuccess: (data) => {
      toast.success('Invitation created');
      const link = `${window.location.origin}/accept-invite?token=${data.token}`;
      void navigator.clipboard.writeText(link);
      toast.info('Invite link copied to clipboard', { duration: 8000 });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.usersStats });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit =
    form.fullName.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.address.trim() &&
    form.cnic.trim() &&
    form.gender &&
    form.roleId &&
    form.branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-4 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
              <UserPlus className="h-[18px] w-[18px] text-[var(--text-main-900)]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <DialogTitle>Invite User</DialogTitle>              <DialogDescription className="mt-1">
                Enter the details to add new customer
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

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">            <div>
              <FieldLabel required>Full Name</FieldLabel>
              <input
                className={inviteFieldClassName}
                placeholder="e.g., Nørrebro Kulturhus"
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel required>Email</FieldLabel>
              <input
                type="email"
                className={inviteFieldClassName}
                placeholder="e.g., info@nexium.edu.pk"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel required>Phone Number</FieldLabel>
              <InvitePhoneField
                countryCode={form.phoneCountryCode}
                onCountryCodeChange={(code) => update('phoneCountryCode', code)}
                value={form.phone}
                onChange={(value) => update('phone', value)}
                required
              />
            </div>
            <div>
              <FieldLabel required>Address</FieldLabel>
              <input
                className={inviteFieldClassName}
                placeholder="Enter Address"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>CNIC</FieldLabel>
                <input
                  className={inviteFieldClassName}
                  placeholder="Enter CNIC"
                  value={form.cnic}
                  onChange={(e) => update('cnic', e.target.value)}
                  required
                />
              </div>
              <div>
                <FieldLabel required>Gender</FieldLabel>
                <SelectDropdown
                  aria-label="Select gender"
                  placeholder="Select Gender"
                  value={form.gender}
                  onValueChange={(value) => update('gender', value)}
                  options={[
                    { value: '', label: 'Select Gender' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Select Role</FieldLabel>
                <SelectDropdown
                  aria-label="Select role"
                  placeholder="Select Role"
                  value={form.roleId}
                  onValueChange={(value) => update('roleId', value)}
                  options={[
                    { value: '', label: 'Select Role' },
                    ...(roles?.data.map((role) => ({ value: role.id, label: role.name })) ?? []),
                  ]}
                  className="w-full"
                />
              </div>
              <div>
                <FieldLabel required>Select Branch</FieldLabel>
                <SelectDropdown
                  aria-label="Select branch"
                  placeholder="Select Branch"
                  value={form.branchId}
                  onValueChange={(value) => update('branchId', value)}
                  options={[
                    { value: '', label: 'Select Branch' },
                    ...(branches?.data.map((branch) => ({ value: branch.id, label: branch.name })) ?? []),
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-5 pt-4">            <button
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
              disabled={inviteMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
