'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { useBranches } from '@/hooks/use-branches';
import { ListRow } from '@/components/layout/list-row';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

export function BranchesClient() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');

  const { data, isLoading, error } = useBranches(token);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/branches/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Branch updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      setEditId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/branches/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Branch deactivated');
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; code: string; city?: string }) =>
      apiClient('/branches', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Branch created');
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      setShowForm(false);
      setName('');
      setCode('');
      setCity('');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create branch'),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add branch'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New branch</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ name, code, ...(city ? { city } : {}) });
              }}
            >
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Button type="submit" disabled={createMutation.isPending} className="sm:col-span-3 w-fit">
                Create branch
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All branches ({data?.data.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          {error && <p className="text-red-600">Failed to load branches</p>}
          <div className="divide-y divide-border">
            {data?.data.map((branch) => (
              <div key={branch.id} className="py-3">
                {editId === branch.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
                    <Button
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: branch.id,
                          body: { name: editName, city: editCity || undefined },
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <ListRow
                    actions={
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`text-xs font-medium ${branch.isActive !== false ? 'text-green-600' : 'text-muted-foreground'}`}
                        >
                          {branch.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditId(branch.id);
                            setEditName(branch.name);
                            setEditCity(branch.city ?? '');
                          }}
                        >
                          Edit
                        </Button>
                        {branch.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => {
                              if (confirm(`Deactivate ${branch.name}?`)) {
                                deactivateMutation.mutate(branch.id);
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    }
                  >
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.code} · {branch.city ?? '—'}
                    </p>
                  </ListRow>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
