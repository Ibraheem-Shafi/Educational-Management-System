'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  roles: Array<{ code: string; name: string }>;
  branch?: { name: string } | null;
}

interface Role {
  id: string;
  code: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: { name: string } | null;
  expiresAt: string;
}

export default function UsersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [page, setPage] = useState(1);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => apiClient<PaginatedResponse<UserRow>>(`/users?page=${page}&limit=20`, { token }),
    enabled: !!token,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient<{ data: Role[] }>('/users/roles', { token }),
    enabled: !!token && showInvite,
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiClient<{ data: Invitation[] }>('/users/invitations', { token }),
    enabled: !!token,
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; roleId: string }) =>
      apiClient<{ token: string }>('/users/invitations', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      toast.success('Invitation created');
      const link = `${window.location.origin}/accept-invite?token=${data.token}`;
      void navigator.clipboard.writeText(link);
      toast.info('Invite link copied to clipboard', { duration: 8000 });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setShowInvite(false);
      setEmail('');
      setRoleId('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: false }),
      }),
    onSuccess: () => {
      toast.success('User deactivated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Staff accounts and invitations"
        actions={
          <Button onClick={() => setShowInvite(!showInvite)}>
            {showInvite ? 'Cancel' : 'Invite user'}
          </Button>
        }
      />

      {showInvite && (
        <Card>
          <CardHeader>
            <CardTitle>Send invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate({ email, roleId });
              }}
            >
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <select
                className={filterSelectClass}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
              >
                <option value="">Select role</option>
                {roles?.data.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={inviteMutation.isPending}>
                Create invitation
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff ({users?.meta.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {users?.data.map((u) => (
              <ListRow
                key={u.id}
                actions={
                  <div className="text-sm text-muted-foreground">
                    <p>{u.roles.map((r) => r.name).join(', ')}</p>
                    <p>{u.branch?.name ?? 'All branches'}</p>
                    {u.isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 text-red-600"
                        onClick={() => {
                          if (confirm(`Deactivate ${u.fullName}?`)) deactivateMutation.mutate(u.id);
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                }
              >
                <p className="font-medium">{u.fullName}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </ListRow>
            ))}
          </div>
          {users && (
            <PaginationBar page={page} totalPages={users.meta.totalPages} onPageChange={setPage} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations ({invitations?.data.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {invitations?.data.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No pending invitations</p>
            )}
            {invitations?.data.map((inv) => (
              <ListRow
                key={inv.id}
                actions={
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                }
              >
                <p className="font-medium">{inv.email}</p>
                <p className="text-sm text-muted-foreground">{inv.role?.name ?? '—'}</p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
