'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Printer, Save, Banknote, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatCurrency,
  payrollPaymentMethods,
  PERMISSIONS,
  type StaffGroup,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';
import { CreateRunDialog } from './create-run-dialog';
import { StructuresPanel } from './structures-panel';
import type { PayrollLine, PayrollRunDetail, PayrollRunSummary } from './types';
import {
  formatPeriod,
  groupLines,
  historyStatusLabel,
  isPayrollPaid,
  lineToSavePayload,
  recomputeLine,
  STAFF_GROUP_LABELS,
  sumLines,
} from './types';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const PAYMENT_OPTIONS = payrollPaymentMethods.map((method) => ({
  value: method,
  label: method === 'bank' ? 'Bank' : method === 'cheque' ? 'Cheque' : 'Cash',
}));

const GROUPS: StaffGroup[] = ['permanent', 'admin', 'visiting'];

function cellInputClass(locked: boolean) {
  return cn(
    'h-8 w-[5.75rem] rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-2 text-right text-sm tabular-nums',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)]',
    locked && 'cursor-not-allowed bg-[var(--neutral-50)] opacity-70',
  );
}

function NumberCell({
  value,
  onChange,
  locked,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  locked: boolean;
  step?: number;
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      disabled={locked}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={cellInputClass(locked)}
    />
  );
}

function TextCell({
  value,
  onChange,
  locked,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      disabled={locked}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(cellInputClass(locked), 'w-28 text-left', className)}
    />
  );
}

function money(value: number) {
  return formatCurrency(value);
}

export function SalarySheetPanel({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName?: string;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);

  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [openDialog, setOpenDialog] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof payrollPaymentMethods)[number]>('bank');
  const [draftLines, setDraftLines] = useState<PayrollLine[]>([]);
  const [dirty, setDirty] = useState(false);

  const yearOptions = useMemo(() => {
    const years = Array.from({ length: 6 }, (_, i) => nowYear - 2 + i);
    return years.map((value) => ({ value: String(value), label: String(value) }));
  }, [nowYear]);

  const runsQuery = useQuery({
    queryKey: queryKeys.payrollRuns(branchId, { limit: 24 }),
    queryFn: () =>
      apiClient<PaginatedResponse<PayrollRunSummary>>(
        `/payroll/runs?branchId=${branchId}&page=1&limit=24`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const selectedRun = (runsQuery.data?.data ?? []).find(
    (run) => run.year === year && run.month === month,
  );

  const sheetQuery = useQuery({
    queryKey: queryKeys.payrollRun(selectedRun?.id ?? 'none'),
    queryFn: () => apiClient<PayrollRunDetail>(`/payroll/runs/${selectedRun!.id}`, { token }),
    enabled: !!token && !!selectedRun?.id,
  });

  useEffect(() => {
    if (!sheetQuery.data) {
      setDraftLines([]);
      setDirty(false);
      return;
    }
    setDraftLines(sheetQuery.data.lines.map(recomputeLine));
    setDirty(false);
  }, [sheetQuery.data]);

  const invalidate = async (runId?: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
    if (runId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRun(runId) });
    }
  };

  const openMonth = useMutation({
    mutationFn: () =>
      apiClient<PayrollRunDetail>('/payroll/runs/open-month', {
        method: 'POST',
        token,
        body: { branchId, year, month },
      }),
    onSuccess: async (run) => {
      toast.success(`Opened salary sheet for ${formatPeriod(year, month)}`);
      await invalidate(run.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSheet = useMutation({
    mutationFn: () =>
      apiClient<PayrollRunDetail>(`/payroll/runs/${selectedRun!.id}/lines`, {
        method: 'POST',
        token,
        body: { lines: draftLines.map(lineToSavePayload) },
      }),
    onSuccess: async (run) => {
      toast.success('Salary sheet saved');
      setDirty(false);
      await invalidate(run.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaid = useMutation({
    mutationFn: () =>
      apiClient(`/payroll/runs/${selectedRun!.id}/mark-paid`, {
        method: 'POST',
        token,
        body: { paymentMethod },
      }),
    onSuccess: async () => {
      toast.success('Salary sheet marked as paid');
      setConfirmPaid(false);
      await invalidate(selectedRun?.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportSheet = useMutation({
    mutationFn: () =>
      apiClient<{ csv: string; filename: string }>(
        `/payroll/runs/${selectedRun!.id}/export?format=csv`,
        { token },
      ),
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateLine = useCallback((id: string, patch: Partial<PayrollLine>) => {
    setDraftLines((current) =>
      current.map((line) => (line.id === id ? recomputeLine({ ...line, ...patch }) : line)),
    );
    setDirty(true);
  }, []);

  const locked = selectedRun ? isPayrollPaid(selectedRun) : true;
  const grouped = groupLines(draftLines);
  const grand = sumLines(draftLines);
  const sheetTitle = `Salary sheet for ${formatPeriod(year, month)}`;
  const campusLabel = branchName ? `${branchName}` : 'Campus';

  if (showCards) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-sub-500)]">
            Staff salary cards feed the monthly sheet (basic, group, EOBI/PESSI, bank account).
          </p>
          <Button variant="outline" onClick={() => setShowCards(false)}>
            Back to sheet
          </Button>
        </div>
        <StructuresPanel branchId={branchId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <p className="mb-1 text-xs text-[var(--text-sub-500)]">Month</p>
            <SelectDropdown
              aria-label="Month"
              value={String(month)}
              onValueChange={(value) => setMonth(Number(value))}
              options={MONTH_OPTIONS}
              fullWidth
            />
          </div>
          <div className="w-28">
            <p className="mb-1 text-xs text-[var(--text-sub-500)]">Year</p>
            <SelectDropdown
              aria-label="Year"
              value={String(year)}
              onValueChange={(value) => setYear(Number(value))}
              options={yearOptions}
              fullWidth
            />
          </div>
          {selectedRun ? (
            <StatusBadge
              code={historyStatusLabel(selectedRun).code}
              label={historyStatusLabel(selectedRun).label}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowCards(true)}>
            <Wallet className="h-4 w-4" />
            Staff cards
          </Button>
          {selectedRun ? (
            <>
              <PermissionGate permission={PERMISSIONS.PAYROLL_MANAGE}>
                <button
                  type="button"
                  disabled={locked || saveSheet.isPending || draftLines.length === 0}
                  onClick={() => saveSheet.mutate()}
                  className={pageHeaderActionClassName}
                >
                  <Save className="h-4 w-4" />
                  {saveSheet.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                </button>
              </PermissionGate>
              <Button
                variant="outline"
                disabled={!selectedRun}
                onClick={() => window.open(`/print/salary-sheets/${selectedRun.id}`, '_blank')}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                disabled={exportSheet.isPending}
                onClick={() => exportSheet.mutate()}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <PermissionGate permission={PERMISSIONS.PAYROLL_MANAGE}>
                <Button
                  disabled={locked || draftLines.length === 0}
                  onClick={() => setConfirmPaid(true)}
                >
                  <Banknote className="h-4 w-4" />
                  Mark paid
                </Button>
              </PermissionGate>
            </>
          ) : (
            <PermissionGate permission={PERMISSIONS.PAYROLL_MANAGE}>
              <button
                type="button"
                disabled={openMonth.isPending}
                onClick={() => openMonth.mutate()}
                className={pageHeaderActionClassName}
              >
                <PageHeaderActionIcon />
                {openMonth.isPending ? 'Opening…' : 'Open month'}
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(runsQuery.data?.data ?? []).map((run) => {
          const active = run.year === year && run.month === month;
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => {
                setYear(run.year);
                setMonth(run.month);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                active
                  ? 'border-[var(--midnight-blue-950,#01366C)] bg-[var(--midnight-blue-950,#01366C)] text-white'
                  : 'border-[var(--stroke-soft-200,#E2E4E9)] bg-white text-[var(--text-sub-500)]',
              )}
            >
              {formatPeriod(run.year, run.month)}
              {isPayrollPaid(run) ? ' · Paid' : ''}
            </button>
          );
        })}
      </div>

      {!selectedRun ? (
        <ContentPanel title={sheetTitle}>
          <div className="px-5 py-10 text-center text-sm text-[var(--text-sub-500)]">
            No salary sheet for {campusLabel} in {formatPeriod(year, month)}. Open the month to
            pull staff cards, last month’s advance/security, and attendance absents.
            {canManage ? (
              <div className="mt-4">
                <button
                  type="button"
                  className={pageHeaderActionClassName}
                  onClick={() => setOpenDialog(true)}
                >
                  <PageHeaderActionIcon />
                  Open month
                </button>
              </div>
            ) : null}
          </div>
        </ContentPanel>
      ) : sheetQuery.isLoading ? (
        <ContentPanel title={sheetTitle}>
          <p className="px-5 py-8 text-sm text-[var(--text-sub-500)]">Loading salary sheet…</p>
        </ContentPanel>
      ) : sheetQuery.error ? (
        <ContentPanel title={sheetTitle}>
          <p className="px-5 py-8 text-sm text-red-600">Unable to load salary sheet.</p>
        </ContentPanel>
      ) : (
        <>
          {GROUPS.map((group) => {
            const rows = grouped[group];
            const totals = sumLines(rows);
            return (
              <ContentPanel
                key={group}
                title={`${STAFF_GROUP_LABELS[group]} · ${campusLabel} · ${formatPeriod(year, month)}`}
              >
                {rows.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">
                    No {STAFF_GROUP_LABELS[group].toLowerCase()} on this sheet.
                  </p>
                ) : (
                  <div className={cn(dataTableWrapperClass, 'rounded-none border-0')}>
                    <table className={cn(dataTableClass, 'min-w-[1680px]')}>
                      <thead>
                        <tr>
                          {(group === 'visiting'
                            ? [
                                'Sr',
                                'Name',
                                'Account',
                                'Designation',
                                'Basic',
                                'Rate / class',
                                'Lectures',
                                'Lectures amt',
                                'Other allw',
                                'Absents',
                                'Ded. days',
                                'Absent fine',
                                'Advance',
                                'Security',
                                'EOBI',
                                'PESSI',
                                'Net pay',
                                'Pending adv',
                                'Sec. till date',
                                'Remarks',
                              ]
                            : [
                                'Sr',
                                'Name',
                                'Account',
                                'Designation',
                                'Basic',
                                'Per day',
                                'Days',
                                'Absents',
                                'Ded. days',
                                'Extra lec',
                                'Extra lec amt',
                                'Other allw',
                                'Entitlements',
                                'Absent fine',
                                'Advance',
                                'Security',
                                'EOBI',
                                'PESSI',
                                'Net pay',
                                'Prev adv',
                                'This adv',
                                'Pending adv',
                                'Sec. till date',
                                'Remarks',
                              ]
                          ).map((label) => (
                            <th key={label} className={dataTableThClass}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((line, index) => (
                          <SheetRow
                            key={line.id}
                            index={index}
                            line={line}
                            visiting={group === 'visiting'}
                            locked={locked || !canManage}
                            onChange={updateLine}
                          />
                        ))}
                        <tr className="bg-[var(--palette-navy-soft)]">
                          <td className={cn(dataTableTdClass, 'font-medium')} colSpan={4}>
                            Total ({totals.count})
                          </td>
                          <td className={cn(dataTableTdClass, 'font-medium tabular-nums')}>
                            {money(totals.basicSalary)}
                          </td>
                          <td
                            className={cn(dataTableTdClass, 'font-medium tabular-nums')}
                            colSpan={group === 'visiting' ? 11 : 13}
                          />
                          <td className={cn(dataTableTdClass, 'font-medium tabular-nums')}>
                            {money(totals.netPay)}
                          </td>
                          <td className={dataTableTdClass} colSpan={group === 'visiting' ? 3 : 5} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </ContentPanel>
            );
          })}

          <ContentPanel title="Grand total">
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-4">
              <SummaryStat label="Staff" value={String(grand.count)} />
              <SummaryStat label="Basic" value={money(grand.basicSalary)} />
              <SummaryStat label="Deductions" value={money(grand.deductionsTotal)} />
              <SummaryStat label="Net pay" value={money(grand.netPay)} />
            </div>
          </ContentPanel>
        </>
      )}

      <CreateRunDialog
        branchId={branchId}
        open={openDialog}
        onOpenChange={setOpenDialog}
        onCreated={(run) => {
          setYear(run.year);
          setMonth(run.month);
          void invalidate(run.id);
        }}
      />

      <ConfirmDialog
        open={confirmPaid}
        onOpenChange={setConfirmPaid}
        title="Mark salary sheet as paid?"
        description="This locks the sheet and posts salary expense in accounts. Choose how the campus paid staff."
        confirmLabel={markPaid.isPending ? 'Posting…' : 'Mark paid'}
        loading={markPaid.isPending}
        onConfirm={() => markPaid.mutate()}
      >
        <SelectDropdown
          aria-label="Payment method"
          value={paymentMethod}
          onValueChange={(value) =>
            setPaymentMethod(value as (typeof payrollPaymentMethods)[number])
          }
          options={PAYMENT_OPTIONS}
          fullWidth
        />
      </ConfirmDialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--text-sub-500)]">{label}</p>
      <p className="mt-1 text-lg font-medium text-[var(--text-main-900)]">{value}</p>
    </div>
  );
}

function SheetRow({
  index,
  line,
  visiting,
  locked,
  onChange,
}: {
  index: number;
  line: PayrollLine;
  visiting: boolean;
  locked: boolean;
  onChange: (id: string, patch: Partial<PayrollLine>) => void;
}) {
  const patch = (next: Partial<PayrollLine>) => onChange(line.id, next);
  const identity = (
    <>
      <td className={dataTableTdClass}>{index + 1}</td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap font-medium')}>
        <a
          href={`/print/salary-slips/${line.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--midnight-blue-950,#01366C)] hover:underline"
        >
          {line.user?.fullName ?? '—'}
        </a>
      </td>
      <td className={dataTableTdClass}>
        <TextCell
          value={line.accountNumber ?? ''}
          locked={locked}
          onChange={(accountNumber) => patch({ accountNumber })}
        />
      </td>
      <td className={dataTableTdClass}>
        <TextCell
          value={line.designation ?? ''}
          locked={locked}
          className="w-32"
          onChange={(designation) => patch({ designation })}
        />
      </td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.basicSalary}
          locked={locked}
          step={0.01}
          onChange={(basicSalary) => patch({ basicSalary })}
        />
      </td>
    </>
  );
  const deductions = (
    <>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.absentFine)}</td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.advanceDeduction}
          locked={locked}
          step={0.01}
          onChange={(advanceDeduction) => patch({ advanceDeduction })}
        />
      </td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.securityDeduct}
          locked={locked}
          step={0.01}
          onChange={(securityDeduct) => patch({ securityDeduct })}
        />
      </td>
      <td className={dataTableTdClass}>
        <NumberCell value={line.eobi} locked={locked} step={0.01} onChange={(eobi) => patch({ eobi })} />
      </td>
      <td className={dataTableTdClass}>
        <NumberCell value={line.pessi} locked={locked} step={0.01} onChange={(pessi) => patch({ pessi })} />
      </td>
      <td className={cn(dataTableTdClass, 'font-medium tabular-nums')}>{money(line.netPay)}</td>
    </>
  );
  const closing = (
    <>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.pendingAdvance)}</td>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.securityTillDate)}</td>
      <td className={dataTableTdClass}>
        <TextCell
          value={line.remarks ?? ''}
          locked={locked}
          className="w-40"
          onChange={(remarks) => patch({ remarks })}
        />
      </td>
    </>
  );

  if (visiting) {
    return (
      <tr>
        {identity}
        <td className={dataTableTdClass}>
          <NumberCell
            value={line.ratePerClass}
            locked={locked}
            step={0.01}
            onChange={(ratePerClass) => patch({ ratePerClass })}
          />
        </td>
        <td className={dataTableTdClass}>
          <NumberCell
            value={line.lectureCount}
            locked={locked}
            onChange={(lectureCount) => patch({ lectureCount })}
          />
        </td>
        <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.lecturesAmount)}</td>
        <td className={dataTableTdClass}>
          <NumberCell
            value={line.otherAllowance}
            locked={locked}
            step={0.01}
            onChange={(otherAllowance) => patch({ otherAllowance })}
          />
        </td>
        <td className={dataTableTdClass}>
          <NumberCell value={line.absents} locked={locked} onChange={(absents) => patch({ absents })} />
        </td>
        <td className={cn(dataTableTdClass, 'tabular-nums')}>{line.deductedDays}</td>
        {deductions}
        {closing}
      </tr>
    );
  }

  return (
    <tr>
      {identity}
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.perDay)}</td>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{line.workingDays}</td>
      <td className={dataTableTdClass}>
        <NumberCell value={line.absents} locked={locked} onChange={(absents) => patch({ absents })} />
      </td>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{line.deductedDays}</td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.extraLectures}
          locked={locked}
          onChange={(extraLectures) => patch({ extraLectures })}
        />
      </td>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.extraLecAmount)}</td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.otherAllowance}
          locked={locked}
          step={0.01}
          onChange={(otherAllowance) => patch({ otherAllowance })}
        />
      </td>
      <td className={cn(dataTableTdClass, 'tabular-nums')}>{money(line.entitlementsTotal)}</td>
      {deductions}
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.previousAdvance}
          locked={locked}
          step={0.01}
          onChange={(previousAdvance) => patch({ previousAdvance })}
        />
      </td>
      <td className={dataTableTdClass}>
        <NumberCell
          value={line.currentAdvance}
          locked={locked}
          step={0.01}
          onChange={(currentAdvance) => patch({ currentAdvance })}
        />
      </td>
      {closing}
    </tr>
  );
}
