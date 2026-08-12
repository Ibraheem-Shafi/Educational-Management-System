'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS, createDocumentSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { uploadStudentDocument } from '@/lib/upload-document';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StudentDetailView } from '@/components/features/students/student-detail-view';
import { PermissionGate } from '@/components/auth/permission-gate';
import { IssueCertificateDialog } from '@/components/features/certificates/issue-certificate-dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

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
  const [issueCertOpen, setIssueCertOpen] = useState(false);
  const [docsPage, setDocsPage] = useState(1);
  const [docsLimit, setDocsLimit] = useState(8);
  const [parentsPage, setParentsPage] = useState(1);
  const [parentsLimit, setParentsLimit] = useState(8);
  const canUpdate = can(PERMISSIONS.STUDENTS_UPDATE);
  const canIssueCert = can(PERMISSIONS.CERTIFICATES_ISSUE);
  const canReadCert = can(PERMISSIONS.CERTIFICATES_READ);
  const { validate, applyApiErrors, setFieldError, errors, clearField } =
    useFormErrors(createDocumentSchema);

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => apiClient<StudentDetail>(`/students/${id}`, { token }),
    enabled: !!token && !!id,
  });

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

  const saveSubjectsMutation = useMutation({
    mutationFn: () =>
      apiClient(`/students/${id}/subjects`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      }),
    onSuccess: async () => {
      toast.success('Subjects updated');
      await queryClient.invalidateQueries({ queryKey: ['student-subjects', id] });
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
    queryKey: ['documents', id, docsPage, docsLimit],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; title: string; category: string; createdAt: string }>>(
        `/documents?studentId=${id}&page=${docsPage}&limit=${docsLimit}`,
        { token },
      ),
    enabled: !!token && !!id,
    placeholderData: (previous) => previous,
  });

  const { data: studentParents } = useQuery({
    queryKey: ['student-parents', id, parentsPage, parentsLimit],
    queryFn: () =>
      apiClient<
        PaginatedResponse<{
          id: string;
          fullName: string;
          phone: string | null;
          email: string | null;
          relationshipCode: string;
          linkId: string;
        }>
      >(`/students/${id}/parents?page=${parentsPage}&limit=${parentsLimit}`, { token }),
    enabled: !!token && !!id,
    placeholderData: (previous) => previous,
  });

  const handleDocsLimitChange = useCallback((next: number) => {
    setDocsLimit(next);
    setDocsPage(1);
  }, []);

  const handleParentsLimitChange = useCallback((next: number) => {
    setParentsLimit(next);
    setParentsPage(1);
  }, []);

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadStudentDocument(file, id, student?.branchId ?? '', token!);
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
      clearField('file');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleDocumentUpload = (file: File) => {
    if (!student?.branchId) {
      setFieldError('branchId', 'Branch is required');
      return;
    }
    const payload = {
      branchId: student.branchId,
      studentId: id,
      category: 'other' as const,
      title: file.name,
      storagePath: 'pending',
    };
    if (!validate(payload)) return;
    uploadDocMutation.mutate(file);
  };

  const openDocument = async (docId: string) => {
    try {
      const res = await apiClient<{ url: string }>(`/documents/${docId}/signed-url`, { token });
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const fieldLabelMap = new Map(formFields?.data.map((f) => [f.code, f.label]) ?? []);

  if (isLoading) return <PageContentSkeleton />;
  if (!student) return <p className="text-red-600">Student not found</p>;

  return (
    <div className="space-y-6">
      <StudentDetailView
        student={student}
        onEdit={canUpdate ? () => router.push(`/dashboard/students/${id}/edit`) : undefined}
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
        parentsSection={
          <div className="space-y-4">
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Relationship</th>
                    <th className={dataTableThClass}>Phone</th>
                    <th className={dataTableThClass}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {(studentParents?.data.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                        No parents linked
                      </td>
                    </tr>
                  )}
                  {studentParents?.data.map((parent) => (
                    <tr key={parent.linkId}>
                      <td className={dataTableTdClass}>
                        <Link
                          href={`/dashboard/parents/${parent.id}`}
                          className="font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                        >
                          {parent.fullName}
                        </Link>
                      </td>
                      <td className={cn(dataTableTdClass, 'capitalize')}>{parent.relationshipCode}</td>
                      <td className={dataTableTdClass}>{parent.phone ?? '—'}</td>
                      <td className={dataTableTdClass}>{parent.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {studentParents?.meta && studentParents.meta.totalPages > 0 && (
              <PaginationBar
                page={parentsPage}
                totalPages={studentParents.meta.totalPages}
                onPageChange={setParentsPage}
                limit={parentsLimit}
                onLimitChange={handleParentsLimitChange}
              />
            )}
          </div>
        }
        documentsSection={
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDocumentUpload(file);
                e.target.value = '';
              }}
            />
            <FormFieldError message={errors.file ?? errors.title ?? errors.branchId} />
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
                  {(documents?.data.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={3} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                        No documents uploaded
                      </td>
                    </tr>
                  )}
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
            {documents?.meta && documents.meta.totalPages > 0 && (
              <PaginationBar
                page={docsPage}
                totalPages={documents.meta.totalPages}
                onPageChange={setDocsPage}
                limit={docsLimit}
                onLimitChange={handleDocsLimitChange}
              />
            )}
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
              <Link
                href={`/print/roll-slips/${id}`}
                target="_blank"
                className="inline-flex items-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
              >
                Print roll slip
              </Link>
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
