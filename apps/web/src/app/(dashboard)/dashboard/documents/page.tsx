'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentDocument } from '@/lib/upload-document';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

const CATEGORIES = [
  { value: 'admission_form', label: 'Admission form' },
  { value: 'b_form', label: 'B-Form' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'fee_receipt', label: 'Fee receipt' },
  { value: 'academic_record', label: 'Academic record' },
  { value: 'other', label: 'Other' },
] as const;

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  student?: { fullName: string };
}

interface Student {
  id: string;
  fullName: string;
}

export default function DocumentsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const branchId = user?.branchId ?? '';

  const [showUpload, setShowUpload] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || branches?.data[0]?.id || '';

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: DocumentRow[] }>(
        `/documents?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: students } = useQuery({
    queryKey: ['students-docs'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && showUpload,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !studentId || !title.trim()) throw new Error('Missing fields');
      const uploaded = await uploadStudentDocument(file, studentId);
      return apiClient('/documents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          studentId,
          category,
          title: title.trim(),
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowUpload(false);
      setFile(null);
      setTitle('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDocument = async (id: string) => {
    try {
      const res = await apiClient<{ url: string }>(`/documents/${id}/signed-url`, { token });
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/documents/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Student files and records"
        actions={
          user?.permissions.includes('documents.upload') ? (
            <Button onClick={() => setShowUpload(!showUpload)}>
              {showUpload ? 'Cancel' : 'Upload document'}
            </Button>
          ) : undefined
        }
      />

      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <select
              className={filterSelectClass}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">Student</option>
              {students?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select
              className={filterSelectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button
              className="sm:col-span-2 w-fit"
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              Upload
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All documents ({documents?.data.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {documents?.data.map((doc) => (
              <ListRow
                key={doc.id}
                actions={
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDocument(doc.id)}>
                      Open
                    </Button>
                    {user?.permissions.includes('documents.delete') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Delete this document?')) deleteMutation.mutate(doc.id);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                }
              >
                <p className="font-medium">{doc.title}</p>
                <p className="text-sm text-muted-foreground">
                  {doc.student?.fullName ?? '—'} · {doc.category} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </ListRow>
            ))}
            {documents?.data.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No documents yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
