'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadAttendanceRegister } from '@/lib/upload-attendance-register';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

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
    queryKey: queryKeys.branches,
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
    queryKey: queryKeys.lookups('attendance_status'),
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/attendance_status'),
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.aiAttendanceSessions,
    queryFn: () => apiClient<{ data: OcrSession[] }>('/ai-attendance/sessions', { token }),
    enabled: !!token,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['ai-attendance-session', activeSessionId],
    queryFn: () => apiClient<OcrSession>(`/ai-attendance/sessions/${activeSessionId}`, { token }),
    enabled: !!token && !!activeSessionId,
  });

  const stats = useMemo(() => {
    const list = sessions?.data ?? [];
    return {
      total: list.length,
      pending: list.filter((s) => s.status !== 'confirmed').length,
      confirmed: list.filter((s) => s.status === 'confirmed').length,
      analyzed: list.filter((s) => s.suggestions.length > 0).length,
    };
  }, [sessions?.data]);

  const batchOptions = [
    { value: '', label: 'Select batch' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  const statusOptions = (statuses?.statuses ?? []).map((st) => ({
    value: st.id,
    label: st.label,
  }));

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
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendanceSessions });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendanceSessions });
      setActiveSessionId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suggestions = activeSession?.suggestions ?? [];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ScanLine}
        title="AI Attendance"
        description="Upload a register photo, review suggestions, then confirm — never auto-submitted"
      />

      <MainStatsSection
        isLoading={sessionsLoading}
        stats={[
          { label: 'Total sessions', value: stats.total },
          { label: 'Pending review', value: stats.pending },
          { label: 'Confirmed', value: stats.confirmed },
          { label: 'Analyzed', value: stats.analyzed },
        ]}
      />

      <ContentPanel title="1. Upload register">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <SelectDropdown
            aria-label="Batch"
            placeholder="Select batch"
            value={batchId}
            onValueChange={setBatchId}
            options={batchOptions}
            fullWidth
          />
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
        </div>
      </ContentPanel>

      {activeSessionId && (
        <ContentPanel title="2. Analyze & review">
          <div className="space-y-4 px-5 py-5">
            <textarea
              className="min-h-24 w-full rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-3 text-sm"
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className={thClass}>Student</th>
                      <th className={thClass}>Confidence</th>
                      <th className={thClass}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:last-child>td]:border-b-0">
                    {suggestions.map((s) => (
                      <tr key={s.studentId} className="hover:bg-[var(--neutral-50)]/50">
                        <td className={tdClass}>
                          <p className="font-medium">{s.fullName}</p>
                          {s.sourceLine && (
                            <p className="text-xs text-[var(--text-sub-500)]">{s.sourceLine}</p>
                          )}
                        </td>
                        <td className={tdClass}>{Math.round(s.confidence * 100)}%</td>
                        <td className={tdClass}>
                          <SelectDropdown
                            aria-label="Attendance status"
                            value={statusByStudent[s.studentId] ?? s.statusId ?? ''}
                            onValueChange={(value) =>
                              setStatusByStudent((prev) => ({ ...prev, [s.studentId]: value }))
                            }
                            options={statusOptions}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {suggestions.length > 0 && activeSession?.status !== 'confirmed' && (
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                Confirm attendance
              </Button>
            )}
          </div>
        </ContentPanel>
      )}

      <ContentPanel title="Recent sessions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Status</th>
                <th className={cn(thClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {sessionsLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={3} className={tdClass}>
                      <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                    </td>
                  </tr>
                ))}
              {!sessionsLoading && stats.total === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                    No sessions yet
                  </td>
                </tr>
              )}
              {sessions?.data.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                  <td className={tdClass}>{s.date}</td>
                  <td className={tdClass}>
                    <StatusBadge
                      label={s.status}
                      code={s.status === 'confirmed' ? 'active' : 'pending'}
                    />
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    <RowActionsMenu
                      items={[{ label: 'Open', onClick: () => setActiveSessionId(s.id) }]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentPanel>
    </div>
  );
}
