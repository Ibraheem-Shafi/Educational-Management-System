'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, analyzeOcrSessionSchema, confirmOcrSessionSchema, createOcrSessionSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { uploadAttendanceRegister } from '@/lib/upload-attendance-register';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PermissionGate } from '@/components/auth/permission-gate';
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
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canUseAi = can(PERMISSIONS.AI_ATTENDANCE_USE);

  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rawText, setRawText] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const {
    errors: uploadErrors,
    validate: validateUpload,
    clearField: clearUploadField,
    fieldClassName: uploadFieldClassName,
    applyApiErrors: applyUploadApiErrors,
  } = useFormErrors(createOcrSessionSchema);
  const {
    errors: analyzeErrors,
    validate: validateAnalyze,
    clearField: clearAnalyzeField,
    applyApiErrors: applyAnalyzeApiErrors,
  } = useFormErrors(analyzeOcrSessionSchema);
  const {
    errors: confirmErrors,
    validate: validateConfirm,
    applyApiErrors: applyConfirmApiErrors,
  } = useFormErrors(confirmOcrSessionSchema);

  const sessionsQueryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  }).toString();

  const { singleBranchId } = useEffectiveBranchScope();
  const effectiveBranchId = singleBranchId ?? '';

  const { data: batches } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/batches/options?branchId=${effectiveBranchId}`,
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
    queryKey: queryKeys.aiAttendanceSessions({ page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<OcrSession>>(`/ai-attendance/sessions?${sessionsQueryParams}`, {
        token,
      }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['ai-attendance-session', activeSessionId],
    queryFn: () => apiClient<OcrSession>(`/ai-attendance/sessions/${activeSessionId}`, { token }),
    enabled: !!token && !!activeSessionId,
  });

  const stats = useMemo(() => {
    const list = sessions?.data ?? [];
    return {
      total: sessions?.meta.total ?? list.length,
      pending: list.filter((s) => s.status !== 'confirmed').length,
      confirmed: list.filter((s) => s.status === 'confirmed').length,
      analyzed: list.filter((s) => s.suggestions.length > 0).length,
    };
  }, [sessions?.data, sessions?.meta.total]);

  const batchOptions = [
    { value: '', label: 'Select batch' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  const statusOptions = (statuses?.statuses ?? []).map((st) => ({
    value: st.id,
    label: st.label,
  }));

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      payload,
    }: {
      file: File;
      payload: { branchId: string; batchId: string; date: string; imagePath: string };
    }) => {
      const path = await uploadAttendanceRegister(file, `${effectiveBranchId}-${Date.now()}`);
      const created = await apiClient<OcrSession>('/ai-attendance/sessions', {
        method: 'POST',
        token,
        body: JSON.stringify({ ...payload, imagePath: path }),
      });
      return created;
    },
    onSuccess: (created) => {
      toast.success('Register uploaded');
      setActiveSessionId(created.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendanceSessions() });
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyUploadApiErrors)) return;
      toast.error(err.message);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (body: { rawText?: string }) =>
      apiClient<OcrSession>(`/ai-attendance/sessions/${activeSessionId}/analyze`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
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
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyAnalyzeApiErrors)) return;
      toast.error(err.message);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (body: {
      records: Array<{ studentId: string; statusId: string; remarks?: string }>;
    }) =>
      apiClient(`/ai-attendance/sessions/${activeSessionId}/confirm`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Attendance confirmed');
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendanceSessions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendanceStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTodayAttendance });
      setActiveSessionId(null);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyConfirmApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleUpload = (file: File) => {
    const payload = {
      branchId: effectiveBranchId,
      batchId,
      date,
      imagePath: 'pending',
    };
    if (!validateUpload(payload)) return;
    uploadMutation.mutate({ file, payload });
  };

  const handleAnalyze = () => {
    const payload = rawText.trim() ? { rawText: rawText.trim() } : {};
    if (!validateAnalyze(payload)) return;
    analyzeMutation.mutate(payload);
  };

  const handleConfirm = () => {
    const records = (activeSession?.suggestions ?? []).map((s) => ({
      studentId: s.studentId,
      statusId: statusByStudent[s.studentId] ?? s.statusId ?? '',
      remarks: s.sourceLine ? `OCR: ${s.sourceLine}` : 'AI attendance OCR',
    }));
    const payload = { records };
    if (!validateConfirm(payload)) return;
    confirmMutation.mutate(payload);
  };

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

      <div className="flex justify-end">
        <PageBranchScopeControl />
      </div>

      {!effectiveBranchId && (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to upload and confirm attendance registers.
        </p>
      )}

      <PermissionGate permission={PERMISSIONS.AI_ATTENDANCE_USE}>
        <ContentPanel title="1. Upload register">
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <div>
              <SelectDropdown
                aria-label="Batch"
                placeholder="Select batch"
                value={batchId}
                onValueChange={(value) => {
                  setBatchId(value);
                  clearUploadField('batchId');
                }}
                options={batchOptions}
                fullWidth
                className={uploadFieldClassName('batchId', 'w-full')}
              />
              <FormFieldError message={uploadErrors.batchId} />
            </div>
            <div>
              <DateField
                value={date}
                onValueChange={(next) => {
                  setDate(next);
                  clearUploadField('date');
                }}
                className={uploadFieldClassName('date', '')}
              />
              <FormFieldError message={uploadErrors.date} />
            </div>
            <Input
              type="file"
              accept="image/*"
              className="sm:col-span-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <FormFieldError message={uploadErrors.branchId ?? uploadErrors.imagePath} />
          </div>
        </ContentPanel>
      </PermissionGate>

      {canUseAi && activeSessionId && (
        <ContentPanel title="2. Analyze & review">
          <div className="space-y-4 px-5 py-5">
            <textarea
              className={cn(
                'min-h-24 w-full rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-3 text-sm',
                analyzeErrors.rawText && 'border-red-500',
              )}
              placeholder="Paste OCR text from register (optional if OPENAI_API_KEY is set)"
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                clearAnalyzeField('rawText');
              }}
            />
            <FormFieldError message={analyzeErrors.rawText} />
            <Button
              onClick={handleAnalyze}
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
              <div>
                <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
                  Confirm attendance
                </Button>
                <FormFieldError message={confirmErrors.records} />
              </div>
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
              {sessionsLoading ? (
                <DataTableSkeletonRows columns={3} rows={limit} />
              ) : stats.total === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                    No sessions yet
                  </td>
                </tr>
              ) : (
                sessions?.data.map((s) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {sessions?.meta && (
          <PaginationBar
            page={page}
            totalPages={sessions.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </ContentPanel>
    </div>
  );
}
