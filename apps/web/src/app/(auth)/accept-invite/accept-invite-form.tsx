'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  AuthShell,
  authFieldClassName,
  authPrimaryButtonClassName,
} from '@/components/auth/auth-shell';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';

export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { name } = useInstitution();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () =>
      apiClient<{ email: string; role: { name: string } | null }>(`/auth/invitations/${token}`),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiClient('/auth/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, fullName, password }),
      }),
    onSuccess: () => {
      toast.success('Account created! Please sign in.');
      router.push('/login');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!token) {
    return (
      <AuthShell title="Invalid invitation" description="This invitation link is missing or incomplete.">
        <p className="text-sm leading-6 text-[#5B6578]">Ask your administrator for a new invite link.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${name}`}
      description="Create your password to activate the account linked to this invitation."
    >
      {isLoading && (
        <p className="text-sm text-[#5B6578]">Validating invitation…</p>
      )}
      {error && (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#991B1B]">
          This invitation is invalid or has expired.
        </p>
      )}
      {invite && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            acceptMutation.mutate();
          }}
        >
          <div className="rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] px-4 py-3 text-sm">
            <p>
              <span className="text-[#5B6578]">Email:</span>{' '}
              <span className="font-medium text-[#0A0D14]">{invite.email}</span>
            </p>
            <p className="mt-1">
              <span className="text-[#5B6578]">Role:</span>{' '}
              <span className="font-medium text-[#0A0D14]">{invite.role?.name ?? '—'}</span>
            </p>
          </div>
          <div>
            <FormFieldLabel required>Full name</FormFieldLabel>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={authFieldClassName}
            />
          </div>
          <div>
            <FormFieldLabel required>Password</FormFieldLabel>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className={authFieldClassName}
            />
          </div>
          <Button
            type="submit"
            className={authPrimaryButtonClassName}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? 'Creating account…' : 'Activate account'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
