'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

const MfaSettings = dynamic(
  () => import('@/components/auth/mfa-settings').then((m) => ({ default: m.MfaSettings })),
  { loading: () => <PageContentSkeleton /> },
);

export default function ProfilePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  const { data: sessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () =>
      apiClient<{ data: { id: string; deviceInfo: string | null; lastActiveAt: string }[] }>(
        '/auth/sessions',
        { token },
      ),
    enabled: !!token,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient('/auth/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ fullName, phone: phone || null }),
      }),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/auth/sessions/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My profile" description={user?.email} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save profile
          </Button>
        </CardContent>
      </Card>

      <MfaSettings />

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {sessions?.data.map((s) => (
              <ListRow
                key={s.id}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => revokeMutation.mutate(s.id)}>
                    Revoke
                  </Button>
                }
              >
                <p>{s.deviceInfo ?? 'Unknown device'}</p>
                <p className="text-muted-foreground">{new Date(s.lastActiveAt).toLocaleString()}</p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
