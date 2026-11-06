'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  IMPORT_PIPELINE_FIELDS,
  IMPORT_PIPELINE_LABELS,
  IMPORT_PIPELINES,
  type FeeWideMonthGroup,
  type ImportPipelineType,
} from '@eims/shared';
import { apiClient } from '@/lib/api-client';
import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { cn } from '@/lib/utils';

type Step = 'pipeline' | 'upload' | 'map' | 'dryrun';

interface ColumnPreview {
  header: string;
  letter: string;
  samples: string[];
}

interface ParseResult {
  sheets: string[];
  sheetName: string;
  headerRow: number;
  headerRowAutoDetected?: boolean;
  headers: string[];
  columnPreviews?: ColumnPreview[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isWeakHeader(header: string): boolean {
  return (
    /^col\s*[a-z]+$/i.test(header.trim()) ||
    /^column\s*\d+$/i.test(header.trim()) ||
    /\b20\d{2}\s*[-–]\s*20\d{2}\b/.test(header) ||
    header.length > 28
  );
}

/** Prefer real names (from samples when the “header” is a title / Col X). */
function formatColumnOptionLabel(preview: ColumnPreview): string {
  const sample = preview.samples[0];
  if (sample && isWeakHeader(preview.header)) {
    return `${sample}  (${preview.letter})`;
  }
  if (sample) {
    return `${preview.header}  (${preview.letter})  ·  e.g. “${sample}”`;
  }
  return `${preview.header}  (${preview.letter})`;
}

const FIELD_ALIASES: Record<string, string[]> = {
  fullName: ['studentname', 'studentfullname', 'name', 'fullname'],
  admissionNumber: ['enno', 'enrollment', 'enrolment', 'admission', 'admno', 'admn', 'enrollmentno'],
  rollNumber: ['roll', 'rollno', 'srno', 'sno'],
  fatherName: ['fathername', 'father', 'fname'],
  motherName: ['mothername', 'mother', 'mname'],
  guardianName: ['guardianname', 'guardian'],
  guardianPhone: ['guardianphone', 'whatsapp'],
  phone: ['phone', 'mobileno', 'mobile', 'contactno', 'contact'],
  programName: ['program', 'programme', 'grade'],
  batchName: ['batch', 'section', 'newclass', 'classname', 'class'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate'],
  statusCode: ['status', 'studentstatus'],
};

/** Best-effort auto-map from spreadsheet headers / samples → pipeline fields. */
function suggestColumnMap(
  fields: Array<{ key: string; label: string }>,
  headers: string[],
  previews?: ColumnPreview[],
): Record<string, string> {
  const unused = new Set(headers);
  const map: Record<string, string> = {};
  const previewByHeader = new Map((previews ?? []).map((p) => [p.header, p]));

  for (const field of fields) {
    const targets = [
      field.key,
      field.label,
      ...(FIELD_ALIASES[field.key] ?? []),
    ].map(normalizeHeader);
    let best: string | null = null;
    for (const header of unused) {
      const preview = previewByHeader.get(header);
      const candidates = [header, ...(preview?.samples ?? [])];
      for (const candidate of candidates) {
        const n = normalizeHeader(candidate);
        if (!n || /^col[a-z]+$/.test(n) || /^column\d+$/.test(n)) continue;
        if (targets.some((t) => t && (n === t || n.includes(t) || t.includes(n)))) {
          best = header;
          break;
        }
      }
      if (best) break;
    }
    if (best) {
      map[field.key] = best;
      unused.delete(best);
    }
  }
  return map;
}

interface DryRunPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  sampleErrors: Array<{ rowNumber: number; field?: string; message: string }>;
  canStart: boolean;
}

interface ImportJob {
  id: string;
  status: string;
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'pipeline', label: '1. Pipeline' },
  { id: 'upload', label: '2. Upload' },
  { id: 'map', label: '3. Map' },
  { id: 'dryrun', label: '4. Review' },
];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub-500)]">
      {children}
      {required ? <span className="text-rose-600"> *</span> : null}
    </label>
  );
}

export function ImportWizard({
  branchId,
  token,
  onClose,
}: {
  branchId: string;
  token: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pipeline');
  const [pipeline, setPipeline] = useState<ImportPipelineType>('students');
  const [feeMode, setFeeMode] = useState<'flat' | 'wide'>('flat');
  const [timetableMode, setTimetableMode] = useState<'append' | 'replace'>('append');
  const [createMissingStudents, setCreateMissingStudents] = useState(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /** 0-based index; null = let the API auto-detect on next parse. */
  const [headerRow, setHeaderRow] = useState<number | null>(null);
  const [sheetName, setSheetName] = useState<string | undefined>();
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [monthGroups, setMonthGroups] = useState<FeeWideMonthGroup[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunPreview | null>(null);
  const [uploading, setUploading] = useState(false);

  const fields = IMPORT_PIPELINE_FIELDS[pipeline];
  const allHeaderOptions = useMemo(() => {
    const previews =
      parsed?.columnPreviews ??
      (parsed?.headers ?? []).map((header, i) => ({
        header,
        letter: String.fromCharCode(65 + (i % 26)),
        samples: [] as string[],
      }));
    return [
      { value: '', label: '— not mapped —' },
      ...previews.map((p) => ({
        value: p.header,
        label: formatColumnOptionLabel(p),
      })),
    ];
  }, [parsed?.columnPreviews, parsed?.headers]);

  /** Columns already claimed by another field / month-group cell (exclusive mapping). */
  const claimedHeaders = useMemo(() => {
    const used = new Set<string>();
    for (const v of Object.values(columnMap)) {
      if (v?.trim()) used.add(v);
    }
    for (const g of monthGroups) {
      for (const v of Object.values(g.columns)) {
        if (v?.trim()) used.add(v);
      }
    }
    return used;
  }, [columnMap, monthGroups]);

  function headerOptionsFor(currentValue?: string) {
    return allHeaderOptions.filter(
      (opt) => !opt.value || opt.value === currentValue || !claimedHeaders.has(opt.value),
    );
  }

  function setFieldColumn(fieldKey: string, header: string) {
    setColumnMap((m) => {
      const next = { ...m, [fieldKey]: header };
      if (header) {
        for (const [k, v] of Object.entries(next)) {
          if (k !== fieldKey && v === header) next[k] = '';
        }
      }
      return next;
    });
    if (header) {
      setMonthGroups((groups) =>
        groups.map((g) => {
          const cols = { ...g.columns };
          let changed = false;
          for (const [k, v] of Object.entries(cols)) {
            if (v === header) {
              delete cols[k as keyof typeof cols];
              changed = true;
            }
          }
          return changed ? { ...g, columns: cols } : g;
        }),
      );
    }
  }

  const { data: profiles } = useQuery({
    queryKey: queryKeys.importProfiles({ pipeline, branchId }),
    queryFn: () =>
      apiClient<
        Array<{
          id: string;
          name: string;
          mapping: { columns: Record<string, string>; monthGroups?: FeeWideMonthGroup[] };
          options?: Record<string, unknown>;
        }>
      >(`/imports/mapping-profiles?pipeline=${pipeline}&branchId=${branchId}`, { token }),
    enabled: !!token,
  });

  const parseMutation = useMutation({
    mutationFn: async ({
      path,
      headerRowOverride,
    }: {
      path: string;
      headerRowOverride?: number | null;
    }) => {
      const row =
        headerRowOverride !== undefined ? headerRowOverride : headerRow;
      return apiClient<ParseResult>('/imports/parse', {
        method: 'POST',
        token,
        body: JSON.stringify({
          filePath: path,
          sheetName,
          ...(row != null ? { headerRow: row } : {}),
        }),
      });
    },
    onSuccess: (data) => {
      setParsed(data);
      setHeaderRow(data.headerRow);
      setSheetName(data.sheetName);
      setColumnMap((prev) => {
        const suggested = suggestColumnMap(fields, data.headers, data.columnPreviews);
        // Keep any prior manual picks that still exist as headers
        const next = { ...suggested };
        for (const [k, v] of Object.entries(prev)) {
          if (v && data.headers.includes(v)) next[k] = v;
        }
        return next;
      });
      setStep('map');
      if (data.headerRowAutoDetected && data.headerRow > 0) {
        toast.message(`Using row ${data.headerRow + 1} as headers (title rows skipped)`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAndDryRun = useMutation({
    mutationFn: async () => {
      const job = await apiClient<ImportJob>('/imports/jobs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          pipeline,
          branchId,
          filePath,
          fileName,
          sheetName,
          headerRow: headerRow ?? parsed?.headerRow ?? 0,
          mapping: {
            columns: Object.fromEntries(
              Object.entries(columnMap).filter(([, v]) => v && v.trim()),
            ),
            ...(pipeline === 'fee_register' && feeMode === 'wide' ? { monthGroups } : {}),
          },
          options: {
            ...(pipeline === 'fee_register' ? { feeMode, createMissingStudents } : {}),
            ...(pipeline === 'timetable' ? { timetableMode } : {}),
            ...(pipeline === 'staff' ? { generateStaffPasswords: true } : {}),
          },
        }),
      });
      setJobId(job.id);
      return apiClient<{ job: ImportJob; preview: DryRunPreview }>(
        `/imports/jobs/${job.id}/dry-run`,
        { method: 'POST', token },
      );
    },
    onSuccess: (result) => {
      setPreview(result.preview);
      setStep('dryrun');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('No job');
      return apiClient<ImportJob>(`/imports/jobs/${jobId}/start`, { method: 'POST', token });
    },
    onSuccess: (job) => {
      toast.success('Import started');
      router.push(`/dashboard/imports/${job.id}`);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (name: string) =>
      apiClient('/imports/mapping-profiles', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name,
          pipeline,
          branchId,
          mapping: {
            columns: Object.fromEntries(
              Object.entries(columnMap).filter(([, v]) => v && v.trim()),
            ),
            ...(pipeline === 'fee_register' && feeMode === 'wide' ? { monthGroups } : {}),
          },
          options: {
            ...(pipeline === 'fee_register' ? { feeMode, createMissingStudents } : {}),
            ...(pipeline === 'timetable' ? { timetableMode } : {}),
          },
        }),
      }),
    onSuccess: () => toast.success('Mapping profile saved'),
    onError: (err: Error) => toast.error(err.message),
  });

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadViaSignedUrl(
        file,
        '/imports/prepare-upload',
        token,
        { branchId, mimeType: file.type },
        'data-imports',
      );
      setFilePath(uploaded.path);
      setFileName(uploaded.fileName);
      setHeaderRow(null); // auto-detect on first parse
      await parseMutation.mutateAsync({ path: uploaded.path, headerRowOverride: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function applyProfile(id: string) {
    const profile = profiles?.find((p) => p.id === id);
    if (!profile) return;
    setColumnMap(profile.mapping?.columns ?? {});
    if (profile.mapping?.monthGroups) setMonthGroups(profile.mapping.monthGroups);
    const opts = profile.options ?? {};
    if (opts.feeMode === 'flat' || opts.feeMode === 'wide') setFeeMode(opts.feeMode);
    if (opts.timetableMode === 'append' || opts.timetableMode === 'replace') {
      setTimetableMode(opts.timetableMode);
    }
    toast.success(`Loaded profile “${profile.name}”`);
  }

  const missingRequired = fields
    .filter((f) => f.required)
    .filter((f) => {
      if (pipeline === 'fee_register' && feeMode === 'wide' && f.key === 'billingPeriod') {
        return false;
      }
      return !columnMap[f.key]?.trim();
    });

  const wideFeeHidden = new Set([
    'billingPeriod',
    'tuition',
    'arrears',
    'paid',
    'due',
    'voucherNo',
    'annual',
    'party',
  ]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'flex gap-0 p-0 pb-0',
          step === 'map' || step === 'dryrun' ? 'max-w-[720px]' : 'max-w-[492px]',
        )}
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Upload className="h-5 w-5 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>New data import</DialogTitle>
            <DialogDescription className="mt-1">
              {IMPORT_PIPELINE_LABELS[pipeline]} · map columns, then dry-run
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-2.5">
          {STEPS.map((s) => {
            const active = s.id === step;
            const idx = STEPS.findIndex((x) => x.id === s.id);
            const currentIdx = STEPS.findIndex((x) => x.id === step);
            const done = idx < currentIdx;
            return (
              <span
                key={s.id}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  active && 'bg-[var(--palette-teal-soft)] text-[var(--palette-navy,#01366C)]',
                  done && !active && 'bg-slate-100 text-slate-600',
                  !done && !active && 'text-slate-400',
                )}
              >
                {s.label}
              </span>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 'pipeline' ? (
            <div className="space-y-4">
              <div>
                <FieldLabel required>Pipeline</FieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Pipeline"
                  value={pipeline}
                  onValueChange={(v) => setPipeline(v as ImportPipelineType)}
                  options={IMPORT_PIPELINES.map((p) => ({
                    value: p,
                    label: IMPORT_PIPELINE_LABELS[p],
                  }))}
                />
              </div>
              {pipeline === 'fee_register' ? (
                <>
                  <div>
                    <FieldLabel>Fee register mode</FieldLabel>
                    <SelectDropdown
                      fullWidth
                      aria-label="Fee mode"
                      value={feeMode}
                      onValueChange={(v) => setFeeMode(v as 'flat' | 'wide')}
                      options={[
                        { value: 'flat', label: 'Flat — one row per student-month' },
                        {
                          value: 'wide',
                          label: 'Wide — one student row, month column groups',
                        },
                      ]}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={createMissingStudents}
                      onChange={(e) => setCreateMissingStudents(e.target.checked)}
                    />
                    Create missing students from fee rows
                  </label>
                </>
              ) : null}
              {pipeline === 'timetable' ? (
                <div>
                  <FieldLabel>Timetable mode</FieldLabel>
                  <SelectDropdown
                    fullWidth
                    aria-label="Timetable mode"
                    value={timetableMode}
                    onValueChange={(v) => setTimetableMode(v as 'append' | 'replace')}
                    options={[
                      { value: 'append', label: 'Append slots' },
                      {
                        value: 'replace',
                        label: 'Replace all timetable slots for this campus',
                      },
                    ]}
                  />
                </div>
              ) : null}
              {pipeline === 'students' ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  Map student columns and optional <strong>father/mother/guardian</strong> columns
                  on the same sheet — parents are created with the student rows.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 'upload' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Upload an Excel (.xlsx) or CSV for{' '}
                <strong>{IMPORT_PIPELINE_LABELS[pipeline]}</strong>.
              </p>
              <div>
                <FieldLabel required>File</FieldLabel>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  disabled={uploading || parseMutation.isPending}
                  onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
                />
              </div>
              {parsed?.sheets?.length ? (
                <div>
                  <FieldLabel>Sheet</FieldLabel>
                  <SelectDropdown
                    fullWidth
                    aria-label="Sheet"
                    value={sheetName ?? parsed.sheetName}
                    onValueChange={(name) => {
                      setSheetName(name);
                      if (filePath) {
                        void parseMutation.mutateAsync({
                          path: filePath,
                          headerRowOverride: null,
                        });
                      }
                    }}
                    options={parsed.sheets.map((s) => ({ value: s, label: s }))}
                  />
                </div>
              ) : null}
              {filePath && parsed ? (
                <p className="text-sm text-emerald-700">
                  Parsed {parsed.totalRows.toLocaleString()} data rows from “{fileName}”
                  {parsed.headerRow != null
                    ? ` · headers on spreadsheet row ${parsed.headerRow + 1}`
                    : ''}
                  .
                </p>
              ) : uploading || parseMutation.isPending ? (
                <p className="text-sm text-slate-500">Uploading / parsing…</p>
              ) : null}
            </div>
          ) : null}

          {step === 'map' && parsed ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-slate-50 p-3">
                <div className="w-36">
                  <FieldLabel>Header row (Excel)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={(headerRow ?? parsed.headerRow) + 1}
                    onChange={(e) => {
                      const excelRow = Math.max(1, Number(e.target.value) || 1);
                      setHeaderRow(excelRow - 1);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!filePath || parseMutation.isPending}
                  onClick={() => {
                    if (!filePath) return;
                    void parseMutation.mutateAsync({
                      path: filePath,
                      headerRowOverride: headerRow ?? parsed.headerRow,
                    });
                  }}
                >
                  {parseMutation.isPending ? 'Re-reading…' : 'Re-read headers'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!filePath || parseMutation.isPending}
                  onClick={() => {
                    if (!filePath) return;
                    setHeaderRow(null);
                    void parseMutation.mutateAsync({
                      path: filePath,
                      headerRowOverride: null,
                    });
                  }}
                >
                  Auto-detect
                </Button>
                <p className="basis-full text-xs text-slate-500">
                  If you see “Col A / Col B” or a title like “Student Records…”, set the Excel row
                  that has the real column names (Name, Class, …) and click Re-read headers.
                  Dropdowns show sample cell values to help you map.
                </p>
              </div>

              {profiles && profiles.length > 0 ? (
                <div>
                  <FieldLabel>Load saved mapping profile</FieldLabel>
                  <SelectDropdown
                    fullWidth
                    aria-label="Mapping profile"
                    value=""
                    onValueChange={(id) => id && applyProfile(id)}
                    options={[
                      { value: '', label: '— select profile —' },
                      ...profiles.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </div>
              ) : null}

              <div className="max-h-[min(420px,50vh)] space-y-3 overflow-y-auto rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)] p-3">
                {fields.map((field) => {
                  if (
                    pipeline === 'fee_register' &&
                    feeMode === 'wide' &&
                    wideFeeHidden.has(field.key)
                  ) {
                    return null;
                  }
                  return (
                    <div
                      key={field.key}
                      className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-main-900)]">
                          {field.label}
                          {field.required ? <span className="text-rose-600"> *</span> : null}
                        </div>
                        {field.hint ? (
                          <div className="text-xs text-slate-500">{field.hint}</div>
                        ) : null}
                      </div>
                      <SelectDropdown
                        fullWidth
                        aria-label={field.label}
                        value={columnMap[field.key] ?? ''}
                        onValueChange={(v) => setFieldColumn(field.key, v)}
                        options={headerOptionsFor(columnMap[field.key])}
                      />
                    </div>
                  );
                })}
              </div>

              {pipeline === 'fee_register' && feeMode === 'wide' ? (
                <div className="space-y-2 rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">Month column groups</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setMonthGroups((g) => [...g, { billingPeriod: '2026-04', columns: {} }])
                      }
                    >
                      Add month
                    </Button>
                  </div>
                  {monthGroups.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Add at least one month and map tuition / paid / due columns.
                    </p>
                  ) : null}
                  {monthGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                    >
                      <Input
                        placeholder="Billing period YYYY-MM"
                        value={g.billingPeriod}
                        onChange={(e) =>
                          setMonthGroups((list) =>
                            list.map((item, i) =>
                              i === idx ? { ...item, billingPeriod: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      {(['tuition', 'arrears', 'paid', 'due', 'voucherNo'] as const).map((col) => (
                        <div key={col}>
                          <FieldLabel>{col}</FieldLabel>
                          <SelectDropdown
                            fullWidth
                            aria-label={col}
                            value={g.columns[col] ?? ''}
                            onValueChange={(v) => {
                              setMonthGroups((list) =>
                                list.map((item, i) => {
                                  if (i !== idx) {
                                    if (!v) return item;
                                    const cols = { ...item.columns };
                                    let changed = false;
                                    for (const [k, existing] of Object.entries(cols)) {
                                      if (existing === v) {
                                        delete cols[k as keyof typeof cols];
                                        changed = true;
                                      }
                                    }
                                    return changed ? { ...item, columns: cols } : item;
                                  }
                                  return {
                                    ...item,
                                    columns: { ...item.columns, [col]: v || undefined },
                                  };
                                }),
                              );
                              if (v) {
                                setColumnMap((m) => {
                                  const next = { ...m };
                                  for (const [k, existing] of Object.entries(next)) {
                                    if (existing === v) next[k] = '';
                                  }
                                  return next;
                                });
                              }
                            }}
                            options={headerOptionsFor(g.columns[col])}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setMonthGroups((list) => list.filter((_, i) => i !== idx))}
                      >
                        Remove month
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {missingRequired.length > 0 ? (
                <p className="text-sm text-rose-700">
                  Map required fields: {missingRequired.map((f) => f.label).join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 'dryrun' && preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)] p-3">
                  <div className="text-xl font-semibold">{preview.totalRows}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xl font-semibold text-emerald-800">{preview.validRows}</div>
                  <div className="text-xs text-emerald-800">Valid</div>
                </div>
                <div className="rounded-[12px] border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xl font-semibold text-rose-800">{preview.errorRows}</div>
                  <div className="text-xs text-rose-800">Errors</div>
                </div>
              </div>
              {preview.sampleErrors.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-[12px] border text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs text-slate-500">
                        <th className="p-2 font-medium">Row</th>
                        <th className="p-2 font-medium">Field</th>
                        <th className="p-2 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleErrors.map((e, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2">{e.rowNumber}</td>
                          <td className="p-2">{e.field ?? '—'}</td>
                          <td className="p-2">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-emerald-700">No validation errors in dry-run.</p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-5 py-4">
          {step === 'pipeline' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep('upload')}>
                Continue
              </Button>
            </>
          ) : null}
          {step === 'upload' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('pipeline')}>
                Back
              </Button>
              <Button type="button" disabled={!filePath || !parsed} onClick={() => setStep('map')}>
                Map columns
              </Button>
            </>
          ) : null}
          {step === 'map' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const name = window.prompt('Profile name');
                  if (name?.trim()) saveProfileMutation.mutate(name.trim());
                }}
              >
                Save profile
              </Button>
              <Button
                type="button"
                disabled={
                  missingRequired.length > 0 ||
                  (pipeline === 'fee_register' && feeMode === 'wide' && monthGroups.length === 0) ||
                  createAndDryRun.isPending
                }
                onClick={() => createAndDryRun.mutate()}
              >
                {createAndDryRun.isPending ? 'Validating…' : 'Dry-run'}
              </Button>
            </>
          ) : null}
          {step === 'dryrun' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('map')}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!jobId || startMutation.isPending || preview?.validRows === 0}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending ? 'Starting…' : 'Start import'}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
