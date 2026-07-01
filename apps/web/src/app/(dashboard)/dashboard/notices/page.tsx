'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

const NOTICES_KEYS = ['notices'] as const;

interface Notice {
  id: string;
  title: string;
  body: string;
  audience: string;
  isPublished: boolean;
}

export default function NoticesPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

  useNoticesRealtime(NOTICES_KEYS);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

  const { data, isLoading } = useQuery({
    queryKey: ['notices', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Notice[] }>(`/notices?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient('/notices', { method: 'POST', token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success('Notice created');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      setShowForm(false);
      setTitle('');
      setBody('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/notices/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isPublished: true }),
      }),
    onSuccess: () => {
      toast.success('Notice published');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/notices/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Notice deleted');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        description="Announcements for staff and portals"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New notice'}</Button>
        }
      />

      {!user?.branchId && branches?.data && branches.data.length > 1 && (
        <select
          className={filterSelectClass}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {branches.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create notice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <select
              className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="all">Everyone</option>
              <option value="parents">Parents</option>
              <option value="students">Students</option>
              <option value="staff">Staff</option>
              <option value="teachers">Teachers</option>
            </select>
            <Button
              onClick={() =>
                createMutation.mutate({
                  branchId: effectiveBranchId,
                  title,
                  body,
                  audience,
                })
              }
              disabled={createMutation.isPending || !title || !body}
            >
              Save draft
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All notices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {data?.data.map((notice) => (
              <div key={notice.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{notice.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{notice.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {notice.audience} · {notice.isPublished ? 'Published' : 'Draft'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                  {!notice.isPublished && (
                    <Button size="sm" onClick={() => publishMutation.mutate(notice.id)}>
                      Publish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm('Delete this notice?')) deleteMutation.mutate(notice.id);
                    }}
                  >
                    Delete
                  </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
