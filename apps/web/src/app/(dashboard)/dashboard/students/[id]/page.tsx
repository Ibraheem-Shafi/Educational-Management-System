'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentPhoto } from '@/lib/upload-photo';
import { uploadStudentDocument } from '@/lib/upload-document';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

interface StudentDetail {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnicOrBForm: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  photographUrl: string | null;
  branchId: string;
  customFields?: Record<string, unknown>;
  batch?: { name: string };
  program?: { name: string };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => apiClient<StudentDetail>(`/students/${id}`, { token }),
    enabled: !!token && !!id,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [cnicOrBForm, setCnicOrBForm] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [historyFrom, setHistoryFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [historyTo, setHistoryTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: allSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/subjects', { token }),
    enabled: !!token,
  });

  const { data: studentSubjects } = useQuery({
    queryKey: ['student-subjects', id],
    queryFn: () => apiClient<{ subjects: { id: string; name: string }[] }>(`/students/${id}/subjects`, { token }),
    enabled: !!token && !!id,
  });

  useEffect(() => {
    if (!studentSubjects) return;
    setSelectedSubjectIds(studentSubjects.subjects.map((s) => s.id));
  }, [studentSubjects]);

  const saveSubjectsMutation = useMutation({
    mutationFn: () =>
      apiClient(`/students/${id}/subjects`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      }),
    onSuccess: () => toast.success('Subjects updated'),
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!student) return;
    setFullName(student.fullName);
    setPhone(student.phone ?? '');
    setEmail(student.email ?? '');
    setAddress(student.address ?? '');
    setCnicOrBForm(student.cnicOrBForm ?? '');
    setGender(student.gender ?? '');
    setDateOfBirth(student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '');
  }, [student]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient(`/students/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Student updated');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient(`/students/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Student removed');
      router.push('/dashboard/students');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: attendanceHistory } = useQuery({
    queryKey: ['attendance-history', id, historyFrom, historyTo],
    queryFn: () =>
      apiClient<{
        records: Array<{ date: string; status?: { label: string } | null; remarks: string | null }>;
      }>(`/attendance/history?studentId=${id}&from=${historyFrom}&to=${historyTo}`, { token }),
    enabled: !!token && !!id,
  });

  const { data: formFields } = useQuery({
    queryKey: ['form-fields'],
    queryFn: () =>
      apiClient<{ data: Array<{ code: string; label: string }> }>('/form-fields', { token }),
    enabled: !!token,
  });

  const { data: documents } = useQuery({
    queryKey: ['documents', id],
    queryFn: () =>
      apiClient<{
        data: Array<{ id: string; title: string; category: string; createdAt: string }>;
      }>(`/documents?studentId=${id}`, { token }),
    enabled: !!token && !!id,
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadStudentDocument(file, id);
      return apiClient('/documents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: student?.branchId,
          studentId: id,
          category: 'other',
          title: file.name,
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDocument = async (docId: string) => {
    try {
      const res = await apiClient<{ url: string }>(`/documents/${docId}/signed-url`, { token });
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const fieldLabelMap = new Map(formFields?.data.map((f) => [f.code, f.label]) ?? []);

  const handlePhoto = async (file: File) => {
    try {
      const url = await uploadStudentPhoto(file, id);
      await updateMutation.mutateAsync({ photographUrl: url });
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  if (isLoading) return <PageContentSkeleton />;
  if (!student) return <p>Student not found</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={student.fullName}
        description={`${student.program?.name ?? '—'} · ${student.batch?.name ?? '—'}`}
        actions={<LinkButton href="/dashboard/students">Back to list</LinkButton>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {student.photographUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photographUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
          )}
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input value={cnicOrBForm} onChange={(e) => setCnicOrBForm(e.target.value)} placeholder="CNIC / B-Form" />
          <select
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">Gender —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
          <div className="flex gap-3">
            <Button
              onClick={() =>
                updateMutation.mutate({
                  fullName,
                  phone: phone || undefined,
                  email: email || undefined,
                  address: address || undefined,
                  cnicOrBForm: cnicOrBForm || undefined,
                  gender: gender || undefined,
                  ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth).toISOString() } : {}),
                })
              }
              disabled={updateMutation.isPending}
            >
              Save changes
            </Button>
            <Button variant="outline" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Remove student
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled subjects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allSubjects?.data.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedSubjectIds.includes(s.id)}
                onChange={(e) =>
                  setSelectedSubjectIds((prev) =>
                    e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                  )
                }
              />
              {s.name}
            </label>
          ))}
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => saveSubjectsMutation.mutate()}
            disabled={saveSubjectsMutation.isPending}
          >
            Save subjects
          </Button>
        </CardContent>
      </Card>

      {student.customFields && Object.keys(student.customFields).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional information</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {Object.entries(student.customFields).map(([code, value]) => (
              <div key={code} className="flex justify-between py-2 text-sm">
                <span className="text-muted-foreground">{fieldLabelMap.get(code) ?? code}</span>
                <span>{String(value ?? '—')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents ({documents?.data.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadDocMutation.mutate(file);
            }}
          />
          <div className="divide-y divide-border">
            {documents?.data.map((doc) => (
              <ListRow
                key={doc.id}
                actions={
                  <Button size="sm" variant="outline" onClick={() => openDocument(doc.id)}>
                    Open
                  </Button>
                }
              >
                <p className="font-medium">{doc.title}</p>
                <p className="text-sm text-muted-foreground">{doc.category}</p>
              </ListRow>
            ))}
            {documents?.data.length === 0 && (
              <p className="text-muted-foreground">No documents uploaded</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
            <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
          </div>
          <div className="divide-y divide-border">
            {attendanceHistory?.records.map((r) => (
              <div key={r.date} className="flex justify-between py-2 text-sm">
                <span>{r.date}</span>
                <span>{r.status?.label ?? '—'}</span>
              </div>
            ))}
            {attendanceHistory?.records.length === 0 && (
              <p className="text-muted-foreground">No records in this range</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
