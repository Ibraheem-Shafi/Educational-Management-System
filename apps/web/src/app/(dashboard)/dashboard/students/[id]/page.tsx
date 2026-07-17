'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { uploadStudentPhoto } from '@/lib/upload-photo';
import { uploadStudentDocument } from '@/lib/upload-document';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';
import { StudentDetailView } from '@/components/features/students/student-detail-view';
import { PermissionGate } from '@/components/auth/permission-gate';
import { IssueCertificateDialog } from '@/components/features/certificates/issue-certificate-dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';

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
  status?: { code: string; label: string };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [issueCertOpen, setIssueCertOpen] = useState(false);
  const canUpdate = can(PERMISSIONS.STUDENTS_UPDATE);
  const canDelete = can(PERMISSIONS.STUDENTS_DELETE);
  const canIssueCert = can(PERMISSIONS.CERTIFICATES_ISSUE);
  const canReadCert = can(PERMISSIONS.CERTIFICATES_READ);

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
    queryFn: () =>
      apiClient<{ subjects: { id: string; name: string }[] }>(`/students/${id}/subjects`, { token }),
    enabled: !!token && !!id,
  });

  useEffect(() => {
    if (!studentSubjects) return;
    setSelectedSubjectIds(studentSubjects.subjects.map((s) => s.id));
  }, [studentSubjects]);

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

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient(`/students/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Student updated');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setEditOpen(false);
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
  if (!student) return <p className="text-red-600">Student not found</p>;

  return (
    <div className="space-y-6">
      <StudentDetailView
        student={student}
        onEdit={canUpdate ? () => setEditOpen(true) : undefined}
        subjectsSection={
          <div className="space-y-3">
            {allSubjects?.data.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSubjectIds.includes(s.id)}
                  disabled={!canUpdate}
                  onChange={(e) =>
                    setSelectedSubjectIds((prev) =>
                      e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
            <PermissionGate permission={PERMISSIONS.STUDENTS_UPDATE}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveSubjectsMutation.mutate()}
                disabled={saveSubjectsMutation.isPending}
              >
                Save subjects
              </Button>
            </PermissionGate>
          </div>
        }
        customFieldsSection={
          student.customFields && Object.keys(student.customFields).length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(student.customFields).map(([code, value]) => (
                <div key={code}>
                  <p className="text-sm text-[var(--text-sub-500)]">{fieldLabelMap.get(code) ?? code}</p>
                  <p className="text-sm font-medium">{String(value ?? '—')}</p>
                </div>
              ))}
            </div>
          ) : null
        }
        documentsSection={
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadDocMutation.mutate(file);
              }}
            />
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Title</th>
                    <th className={dataTableThClass}>Category</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents?.data.map((doc) => (
                    <tr key={doc.id}>
                      <td className={dataTableTdClass}>{doc.title}</td>
                      <td className={dataTableTdClass}>{doc.category}</td>
                      <td className={dataTableTdClass}>
                        <Button size="sm" variant="outline" onClick={() => openDocument(doc.id)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
        certificatesSection={
          canReadCert || canIssueCert ? (
            <div className="flex flex-wrap gap-3">
              {canReadCert && (
                <Link
                  href={`/print/id-cards/${id}`}
                  target="_blank"
                  className="inline-flex items-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
                >
                  Print ID card
                </Link>
              )}
              {canIssueCert && (
                <button
                  type="button"
                  onClick={() => setIssueCertOpen(true)}
                  className="inline-flex items-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Issue certificate
                </button>
              )}
              {canReadCert && (
                <Link
                  href="/dashboard/certificates"
                  className="inline-flex items-center text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                >
                  View certificate history
                </Link>
              )}
            </div>
          ) : null
        }
        attendanceSection={
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
              <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            </div>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Date</th>
                    <th className={dataTableThClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory?.records.map((r) => (
                    <tr key={r.date}>
                      <td className={dataTableTdClass}>{r.date}</td>
                      <td className={dataTableTdClass}>{r.status?.label ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
      />

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-medium">Edit student</h2>
            <div className="space-y-3">
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              <Input value={cnicOrBForm} onChange={(e) => setCnicOrBForm(e.target.value)} placeholder="CNIC / B-Form" />
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
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
                Save
              </Button>
            </div>
            {canDelete && (
              <Button
                variant="outline"
                className="mt-3 w-full text-red-600"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Remove student
              </Button>
            )}
          </div>
        </div>
      )}

      {canIssueCert && student.branchId && (
        <IssueCertificateDialog
          open={issueCertOpen}
          onOpenChange={setIssueCertOpen}
          branchId={student.branchId}
          defaultStudentId={student.id}
        />
      )}
    </div>
  );
}
