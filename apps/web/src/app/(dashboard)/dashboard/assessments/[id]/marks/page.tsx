'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/layout/page-header';
import { FilterBar, filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { VirtualList } from '@/components/layout/virtual-list';
import { MarksStudentRow } from '@/components/features/marks-student-row';

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
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

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
      apiClient<{ students: SheetStudent[]; assessment: { name: string; totalMarks: number } }>(
        `/assessments/${id}/marks-sheet?batchId=${batchId}`,
        { token },
      ),
    enabled: !!token && !!batchId,
  });

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
    mutationFn: () => {
      const records = Object.entries(marks)
        .filter(([, v]) => v !== '')
        .map(([studentId, obtainedMarks]) => ({
          studentId,
          subjectId,
          obtainedMarks: Number(obtainedMarks),
          ...(remarks[studentId] ? { remarks: remarks[studentId] } : {}),
        }));
      return apiClient(`/assessments/${id}/marks/bulk`, {
        method: 'POST',
        token,
        body: JSON.stringify({ batchId, records }),
      });
    },
    onSuccess: () => {
      toast.success('Marks saved');
      queryClient.invalidateQueries({ queryKey: sheetKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enter marks"
        description={`${sheet?.assessment.name ?? 'Assessment'} · ${sheet?.assessment.totalMarks ?? '—'} total`}
        actions={<LinkButton href="/dashboard/assessments">Back to assessments</LinkButton>}
      />

      <Card>
        <CardContent className="pt-6">
          <FilterBar>
            <select
              className={filterSelectClass}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">Select batch</option>
              {batches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
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
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!batchId || !subjectId || saveMutation.isPending}
            >
              Save marks
            </Button>
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
