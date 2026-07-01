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
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

interface ParentRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  students: Array<{ relationshipCode: string; student: { id: string; fullName: string } }>;
}

interface Student {
  id: string;
  fullName: string;
}

export default function ParentsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('father');
  const [linkParentId, setLinkParentId] = useState('');
  const [linkStudentId, setLinkStudentId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['parents'],
    queryFn: () => apiClient<PaginatedResponse<ParentRow>>('/parents', { token }),
    enabled: !!token,
  });

  const { data: students } = useQuery({
    queryKey: ['students-parents'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && (showForm || !!linkParentId),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/parents', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Parent created');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      setShowForm(false);
      setFullName('');
      setEmail('');
      setPhone('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkMutation = useMutation({
    mutationFn: ({ parentId, body }: { parentId: string; body: Record<string, unknown> }) =>
      apiClient(`/parents/${parentId}/link-student`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Student linked');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      setLinkParentId('');
      setLinkStudentId('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      apiClient(`/parents/${parentId}/students/${studentId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Student unlinked');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents"
        description="Guardians linked to students"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add parent'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New parent / guardian</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  fullName,
                  ...(email ? { email } : {}),
                  ...(phone ? { phone } : {}),
                  ...(studentId ? { studentId, relationshipCode: relationship } : {}),
                });
              }}
            >
              <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <select
                className={filterSelectClass}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Link to student (optional)</option>
                {students?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              {studentId && (
                <select
                  className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
              )}
              <Button type="submit" disabled={createMutation.isPending} className="sm:col-span-2 w-fit">
                Save parent
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All parents ({data?.meta.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {data?.data.map((parent) => (
              <div key={parent.id} className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{parent.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {parent.email ?? '—'} · {parent.phone ?? '—'}
                    </p>
                    {parent.students.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {parent.students.map((s) => (
                          <li key={s.student.id} className="flex flex-wrap items-center gap-2">
                            <span>
                              {s.student.fullName} ({s.relationshipCode})
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-destructive"
                              onClick={() =>
                                unlinkMutation.mutate({
                                  parentId: parent.id,
                                  studentId: s.student.id,
                                })
                              }
                              disabled={unlinkMutation.isPending}
                            >
                              Unlink
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLinkParentId(linkParentId === parent.id ? '' : parent.id)}
                  >
                    Link student
                  </Button>
                </div>
                {linkParentId === parent.id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      className="flex h-9 rounded-md border border-border bg-background px-3 text-sm"
                      value={linkStudentId}
                      onChange={(e) => setLinkStudentId(e.target.value)}
                    >
                      <option value="">Select student</option>
                      {students?.data.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={!linkStudentId}
                      onClick={() =>
                        linkMutation.mutate({
                          parentId: parent.id,
                          body: { studentId: linkStudentId, relationshipCode: 'guardian' },
                        })
                      }
                    >
                      Link
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
