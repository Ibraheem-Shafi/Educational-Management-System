'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { printQueryUiState } from '@/components/print/print-shell';
import { formatPeriod, parsePayrollBreakdown } from '@/components/features/payroll/types';

interface PrintData {
  line: {
    basicSalary: number;
    allowancesTotal: number;
    deductionsTotal: number;
    adjustmentsTotal: number;
    netPay: number;
    attendancePresentDays: number;
    attendanceAbsentDays: number;
    workingDays: number;
    breakdown: unknown;
  };
  run: {
    year: number;
    month: number;
    status: string;
    paidAt?: string | null;
    paymentMethod?: string | null;
  };
  employee: {
    fullName: string;
    staffCode: string;
    designation: string | null;
    department: string | null;
    branch: { name: string } | null;
  };
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
  };
  components: Array<{ kind: string; name: string; amount: number; group?: string }>;
  fullBasicSalary?: number | null;
  unpaidAbsentDays?: number | null;
  paidLeaveDays?: number | null;
  lwpAmount?: number | null;
  adjustmentReason?: string | null;
  attendanceNotMarked?: boolean;
}

export default function PrintSalarySlipPage() {
  const { lineId } = useParams<{ lineId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: queryKeys.payrollLinePrint(lineId),
    queryFn: () => apiClient<PrintData>(`/payroll/lines/${lineId}/print-data`, { token }),
    enabled: !!token && !!lineId,
  });

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const { loading, error: showError } = printQueryUiState({
    authLoading,
    hasToken: !!token,
    ready: !!lineId,
    isLoading,
    isPending,
    error,
    data,
  });

  if (loading) {
    return (
      <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing salary slip…</p>
    );
  }

  if (showError || !data) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load salary slip</p>;
  }

  const period = formatPeriod(data.run.year, data.run.month);
  const breakdown = parsePayrollBreakdown(data.line.breakdown);
  const components = data.components.length > 0 ? data.components : breakdown.components;
  const allowances = components.filter((c) => c.kind === 'allowance');
  const lwpItems = components.filter((c) => c.group === 'lwp' || c.name === 'Leave without pay');
  const statutory = components.filter((c) =>
    ['tax', 'eobi', 'provident_fund'].includes(c.kind),
  );
  const otherDeductions = components.filter(
    (c) =>
      c.kind === 'deduction' &&
      c.group !== 'lwp' &&
      c.name !== 'Leave without pay',
  );
  const lwpAmount = data.lwpAmount ?? breakdown.lwpAmount ?? lwpItems.reduce((s, c) => s + c.amount, 0);
  const fullBasic = data.fullBasicSalary ?? breakdown.fullBasicSalary ?? data.line.basicSalary;
  const attendanceNotMarked = data.attendanceNotMarked ?? breakdown.attendanceNotMarked;
  const paidLeaveDays = data.paidLeaveDays ?? breakdown.paidLeaveDays ?? 0;
  const unpaidAbsentDays = data.unpaidAbsentDays ?? breakdown.unpaidAbsentDays ?? data.line.attendanceAbsentDays;
  const adjustmentReason = data.adjustmentReason ?? breakdown.adjustmentReason;
  const gross = fullBasic + data.line.allowancesTotal;

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>
      <div className="no-print flex justify-end gap-2 border-b border-[var(--stroke-soft-200,#E2E4E9)] p-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white"
        >
          Print
        </button>
      </div>
      <div className="mx-auto max-w-2xl p-8 print:p-0">
        <div className="rounded-2xl border border-[var(--stroke-soft-200,#E2E4E9)] p-8">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] pb-6">
            <div>
              {data.institution.logoUrl && !data.institution.logoUrl.startsWith('storage://') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.institution.logoUrl}
                  alt=""
                  className="mb-3 h-12 object-contain"
                />
              )}
              <p className="text-lg font-semibold text-[var(--text-main-900)]">
                {data.institution.name}
              </p>
              {data.institution.address && (
                <p className="mt-1 text-sm text-[var(--text-sub-500)]">{data.institution.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
                Salary slip
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--midnight-blue-950,#01366C)]">
                For the month of {period}
              </p>
              {data.run.paidAt ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Paid
                  {data.run.paymentMethod ? ` · ${data.run.paymentMethod}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-sub-500)]">Employee</p>
              <p className="mt-1 font-semibold text-[var(--text-main-900)]">
                {data.employee.fullName}
              </p>
              <p className="text-sm text-[var(--text-sub-500)]">{data.employee.staffCode}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-sub-500)]">Department</p>
              <p className="mt-1 text-sm text-[var(--text-main-900)]">
                {data.employee.department ?? '—'}
              </p>
              <p className="text-sm text-[var(--text-sub-500)]">
                {data.employee.designation ?? '—'}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[10px] bg-[#F8F8F8] px-4 py-3 text-sm">
            {attendanceNotMarked ? (
              <>Attendance was not marked this month — full salary paid ({data.line.workingDays} working days)</>
            ) : (
              <>
                Attendance: {data.line.attendancePresentDays} present / {data.line.workingDays}{' '}
                working days · {unpaidAbsentDays} unpaid absence
                {paidLeaveDays ? ` · ${paidLeaveDays} paid leave` : ''}
              </>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-main-900)]">Earnings</p>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 text-[var(--text-sub-500)]">Basic salary</td>
                    <td className="py-1 text-right font-medium">{formatCurrency(fullBasic)}</td>
                  </tr>
                  {allowances.map((c) => (
                    <tr key={c.name}>
                      <td className="py-1 text-[var(--text-sub-500)]">{c.name}</td>
                      <td className="py-1 text-right">{formatCurrency(c.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--stroke-soft-200,#E2E4E9)]">
                    <td className="py-2 font-medium">Gross</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(gross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-main-900)]">Deductions</p>
              <table className="w-full text-sm">
                <tbody>
                  {lwpAmount > 0 && (
                    <tr>
                      <td className="py-1 text-[var(--text-sub-500)]">Leave without pay</td>
                      <td className="py-1 text-right">{formatCurrency(lwpAmount)}</td>
                    </tr>
                  )}
                  {otherDeductions.map((c) => (
                    <tr key={c.name}>
                      <td className="py-1 text-[var(--text-sub-500)]">{c.name}</td>
                      <td className="py-1 text-right">{formatCurrency(c.amount)}</td>
                    </tr>
                  ))}
                  {statutory.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={2} className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
                          Statutory
                        </td>
                      </tr>
                      {statutory.map((c) => (
                        <tr key={c.name}>
                          <td className="py-1 text-[var(--text-sub-500)]">{c.name}</td>
                          <td className="py-1 text-right">{formatCurrency(c.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  {lwpAmount <= 0 && otherDeductions.length === 0 && statutory.length === 0 && (
                    <tr>
                      <td className="py-1 text-[var(--text-sub-500)]">—</td>
                      <td className="py-1 text-right">{formatCurrency(0)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-[var(--stroke-soft-200,#E2E4E9)]">
                    <td className="py-2 font-medium">Total deductions</td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(data.line.deductionsTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {data.line.adjustmentsTotal !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-sub-500)]">
                  Adjustments{adjustmentReason ? ` (${adjustmentReason})` : ''}
                </span>
                <span className="font-medium">{formatCurrency(data.line.adjustmentsTotal)}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-[var(--stroke-soft-200,#E2E4E9)] pt-6">
            <p className="text-sm text-[var(--text-sub-500)]">Net pay</p>
            <p className="text-2xl font-semibold text-[var(--midnight-blue-950,#01366C)]">
              {formatCurrency(data.line.netPay)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
