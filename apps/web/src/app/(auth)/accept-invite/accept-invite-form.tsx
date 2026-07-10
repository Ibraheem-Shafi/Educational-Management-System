'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

const primaryButtonClassName = cn(
  'h-10 w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
  'text-sm font-medium leading-5 tracking-[-0.006em] text-white',
  'hover:bg-[var(--midnight-blue-950,#01366C)] hover:opacity-90',
);

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
      <div className="flex min-h-screen items-center justify-center p-4 font-[family-name:var(--font-inter)]">
        <p className="text-[var(--text-sub-500,#525866)]">Invalid invitation link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-weak-50,#F6F8FA)] p-4 font-[family-name:var(--font-inter)]">
      <Card className="w-full max-w-md rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <GraduationCap className="h-6 w-6 text-[var(--midnight-blue-950,#01366C)]" />
          </div>
          <CardTitle className="font-[family-name:var(--font-inter)] text-[var(--text-main-900,#0A0D14)]">
            Join {name}
          </CardTitle>
          <CardDescription className="font-[family-name:var(--font-inter)] text-[var(--text-sub-500,#525866)]">
            Complete your account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-center text-[var(--text-sub-500,#525866)]">Validating invitation...</p>
          )}
          {error && (
            <p className="text-center text-red-600">This invitation is invalid or has expired.</p>
          )}
          {invite && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                acceptMutation.mutate();
              }}
            >
              <div className="rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--bg-weak-50,#F6F8FA)] p-3 text-sm">
                <p>
                  <span className="text-[var(--text-sub-500,#525866)]">Email:</span>{' '}
                  <span className="text-[var(--text-main-900,#0A0D14)]">{invite.email}</span>
                </p>
                <p>
                  <span className="text-[var(--text-sub-500,#525866)]">Role:</span>{' '}
                  <span className="text-[var(--text-main-900,#0A0D14)]">
                    {invite.role?.name ?? '—'}
                  </span>
                </p>
              </div>
              <div>
                <FormFieldLabel required>Full name</FormFieldLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={modalFieldClassName}
                />
              </div>
              <div>
                <FormFieldLabel required>Password</FormFieldLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className={modalFieldClassName}
                />
              </div>
              <Button
                type="submit"
                className={primaryButtonClassName}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? 'Creating account...' : 'Activate account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
