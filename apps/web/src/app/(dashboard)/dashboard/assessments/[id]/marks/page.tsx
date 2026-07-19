'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS, bulkMarksSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/layout/page-header';
import { FilterBar, filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { VirtualList } from '@/components/layout/virtual-list';
import { MarksStudentRow } from '@/components/features/marks-student-row';
import { PermissionGate } from '@/components/auth/permission-gate';

interface Batch {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface SheetStudent {
  studentId: string;
  fullName: string;
  marks: Array<{
    subjectId: string;
    record: { obtainedMarks: number | null; remarks: string | null } | null;
  }>;
}

export default function MarksEntryPage() {
  const { id } = useParams<{ id: string }>();
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canEnterMarks = can(PERMISSIONS.ASSESSMENTS_MARKS_ENTER);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const { errors, validate, clearField, applyApiErrors } = useFormErrors(bulkMarksSchema);

  const { data: batches } = useQuery({
    queryKey: ['batches', user?.branchId],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(
        `/batches${user?.branchId ? `?branchId=${user.branchId}` : ''}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: Subject[] }>('/subjects', { token }),
    enabled: !!token,
  });

  const sheetKey = ['marks-sheet', id, batchId];
  const { data: sheet, isLoading } = useQuery({
    queryKey: sheetKey,
    queryFn: () =>
      apiClient<{
        students: SheetStudent[];
        assessment: { name: string; totalMarks: number; status: string };
      }>(`/assessments/${id}/marks-sheet?batchId=${batchId}`, { token }),
    enabled: !!token && !!batchId,
  });

  const isPublished = sheet?.assessment.status === 'published';

  useEffect(() => {
    if (!sheet || !subjectId) return;
    const initial: Record<string, string> = {};
    const initialRemarks: Record<string, string> = {};
    for (const row of sheet.students) {
      const m = row.marks.find((x) => x.subjectId === subjectId);
      if (m?.record?.obtainedMarks != null) {
        initial[row.studentId] = String(m.record.obtainedMarks);
      }
      if (m?.record?.remarks) {
        initialRemarks[row.studentId] = m.record.remarks;
      }
    }
    setMarks(initial);
    setRemarks(initialRemarks);
  }, [sheet, subjectId]);

  const handleMarksChange = useCallback((studentId: string, value: string) => {
    setMarks((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  const handleRemarksChange = useCallback((studentId: string, value: string) => {
    setRemarks((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  const saveMutation = useMutation({
    mutationFn: (body: {
      batchId: string;
      records: Array<{
        studentId: string;
        subjectId: string;
        obtainedMarks: number;
        remarks?: string;
      }>;
    }) =>
      apiClient(`/assessments/${id}/marks/bulk`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Marks saved');
      queryClient.invalidateQueries({ queryKey: sheetKey });
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSave = () => {
    const records = Object.entries(marks)
      .filter(([, v]) => v !== '')
      .map(([studentId, obtainedMarks]) => ({
        studentId,
        subjectId,
        obtainedMarks: Number(obtainedMarks),
        ...(remarks[studentId] ? { remarks: remarks[studentId] } : {}),
      }));
    const payload = { batchId, records };
    if (!validate(payload)) return;
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enter marks"
        description={`${sheet?.assessment.name ?? 'Assessment'} · ${sheet?.assessment.totalMarks ?? '—'} total`}
        actions={
          <div className="flex flex-wrap gap-2">
            {batchId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
                  const url = `${base}/assessments/${id}/export.csv?batchId=${batchId}`;
                  void fetch(url, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  })
                    .then(async (res) => {
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const disp = res.headers.get('Content-Disposition');
                      const match = disp?.match(/filename="([^"]+)"/);
                      const name = match?.[1] ?? 'results.csv';
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = name;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    })
                    .catch(() => toast.error('Unable to export results'));
                }}
              >
                Export CSV
              </Button>
            )}
            <LinkButton href="/dashboard/assessments">Back to assessments</LinkButton>
          </div>
        }
      />

      {isPublished && (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This assessment is published. Marks cannot be edited until it is unpublished.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <FilterBar>
            <div>
              <select
                className={filterSelectClass}
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  clearField('batchId');
                }}
              >
                <option value="">Select batch</option>
                {batches?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <FormFieldError message={errors.batchId} />
            </div>
            <div>
              <select
                className={filterSelectClass}
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={!batchId}
              >
                <option value="">Select subject</option>
                {subjects?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <PermissionGate permission={PERMISSIONS.ASSESSMENTS_MARKS_ENTER}>
              <div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || isPublished}
                >
                  Save marks
                </Button>
                <FormFieldError message={errors.records} />
              </div>
            </PermissionGate>
          </FilterBar>
        </CardContent>
      </Card>

      {batchId && subjectId && (
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <ListLoadingSkeleton />}
            {sheet && sheet.students.length > 0 && (
              <VirtualList
                items={sheet.students}
                estimateSize={72}
                maxHeight={520}
                getKey={(row) => row.studentId}
                renderItem={(row) => (
                  <MarksStudentRow
                    studentId={row.studentId}
                    fullName={row.fullName}
                    marks={marks[row.studentId] ?? ''}
                    remarks={remarks[row.studentId] ?? ''}
                    onMarksChange={handleMarksChange}
                    onRemarksChange={handleRemarksChange}
                    disabled={!canEnterMarks || isPublished}
                  />
                )}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
