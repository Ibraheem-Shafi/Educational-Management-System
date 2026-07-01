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
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Invalid invitation link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--institution-primary)]/10">
            <GraduationCap className="h-6 w-6 text-[var(--institution-primary)]" />
          </div>
          <CardTitle>Join {name}</CardTitle>
          <CardDescription>Complete your account setup</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center text-muted-foreground">Validating invitation...</p>}
          {error && (
            <p className="text-center text-red-600">
              This invitation is invalid or has expired.
            </p>
          )}
          {invite && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                acceptMutation.mutate();
              }}
            >
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span> {invite.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Role:</span> {invite.role?.name ?? '—'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={acceptMutation.isPending}>
                {acceptMutation.isPending ? 'Creating account...' : 'Activate account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
