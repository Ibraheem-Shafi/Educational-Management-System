'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadAttendanceRegister } from '@/lib/upload-attendance-register';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';

interface OcrSession {
  id: string;
  batchId: string;
  date: string;
  status: string;
  suggestions: Array<{
    studentId: string;
    fullName: string;
    statusCode: string;
    statusId: string | null;
    confidence: number;
    sourceLine: string | null;
  }>;
}

interface LookupStatus {
  id: string;
  code: string;
  label: string;
}

export default function AiAttendancePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const branchId = user?.branchId ?? '';

  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rawText, setRawText] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, string>>({});

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || branches?.data[0]?.id || '';

  const { data: batches } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/batches?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: statuses } = useQuery({
    queryKey: ['lookups', 'attendance_status'],
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/attendance_status'),
  });

  const { data: sessions } = useQuery({
    queryKey: ['ai-attendance-sessions'],
    queryFn: () => apiClient<{ data: OcrSession[] }>('/ai-attendance/sessions', { token }),
    enabled: !!token,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['ai-attendance-session', activeSessionId],
    queryFn: () => apiClient<OcrSession>(`/ai-attendance/sessions/${activeSessionId}`, { token }),
    enabled: !!token && !!activeSessionId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadAttendanceRegister(file, `${effectiveBranchId}-${Date.now()}`);
      const created = await apiClient<OcrSession>('/ai-attendance/sessions', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          batchId,
          date,
          imagePath: path,
        }),
      });
      return created;
    },
    onSuccess: (created) => {
      toast.success('Register uploaded');
      setActiveSessionId(created.id);
      queryClient.invalidateQueries({ queryKey: ['ai-attendance-sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiClient<OcrSession>(`/ai-attendance/sessions/${activeSessionId}/analyze`, {
        method: 'POST',
        token,
        body: JSON.stringify(rawText ? { rawText } : {}),
      }),
    onSuccess: (data) => {
      toast.success('Analysis complete — review suggestions');
      const map: Record<string, string> = {};
      for (const s of data.suggestions) {
        if (s.statusId) map[s.studentId] = s.statusId;
      }
      setStatusByStudent(map);
      queryClient.invalidateQueries({ queryKey: ['ai-attendance-session', activeSessionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiClient(`/ai-attendance/sessions/${activeSessionId}/confirm`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          records: (activeSession?.suggestions ?? []).map((s) => ({
            studentId: s.studentId,
            statusId: statusByStudent[s.studentId] ?? s.statusId,
            remarks: s.sourceLine ? `OCR: ${s.sourceLine}` : 'AI attendance OCR',
          })),
        }),
      }),
    onSuccess: () => {
      toast.success('Attendance confirmed');
      queryClient.invalidateQueries({ queryKey: ['ai-attendance-sessions'] });
      setActiveSessionId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suggestions = activeSession?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Attendance"
        description="Upload a register photo, review suggestions, then confirm — never auto-submitted"
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Upload register</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <select
            className={filterSelectClass}
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
          >
            <option value="">Batch</option>
            {batches?.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            type="file"
            accept="image/*"
            className="sm:col-span-2"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && batchId) uploadMutation.mutate(file);
              else if (!batchId) toast.error('Select a batch first');
            }}
          />
        </CardContent>
      </Card>

      {activeSessionId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Analyze & review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Paste OCR text from register (optional if OPENAI_API_KEY is set)"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending || activeSession?.status === 'confirmed'}
            >
              Analyze register
            </Button>

            {suggestions.length > 0 && (
              <div className="divide-y divide-border">
                {suggestions.map((s) => (
                  <div key={s.studentId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium">{s.fullName}</p>
                      <p className="text-muted-foreground">
                        Confidence {Math.round(s.confidence * 100)}%
                        {s.sourceLine ? ` · ${s.sourceLine}` : ''}
                      </p>
                    </div>
                    <select
                      className="flex h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={statusByStudent[s.studentId] ?? s.statusId ?? ''}
                      onChange={(e) =>
                        setStatusByStudent((prev) => ({ ...prev, [s.studentId]: e.target.value }))
                      }
                    >
                      {statuses?.statuses.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length > 0 && activeSession?.status !== 'confirmed' && (
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                Confirm attendance
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {sessions?.data.map((s) => (
              <ListRow
                key={s.id}
                actions={
                  <Button size="sm" variant="outline" onClick={() => setActiveSessionId(s.id)}>
                    Open
                  </Button>
                }
              >
                <p className="text-sm">
                  {s.date} · {s.status}
                </p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
