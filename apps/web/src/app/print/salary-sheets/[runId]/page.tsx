'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PrintInstitutionHeader, printQueryUiState } from '@/components/print/print-shell';
import type { PayrollLine, PayrollRunDetail } from '@/components/features/payroll/types';
import {
  formatPeriod,
  groupLines,
  isPayrollPaid,
  STAFF_GROUP_LABELS,
  sumLines,
} from '@/components/features/payroll/types';
import type { StaffGroup } from '@eims/shared';

interface PrintData {
  run: PayrollRunDetail;
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
  };
}

const GROUPS: StaffGroup[] = ['permanent', 'admin', 'visiting'];

function money(value: number) {
  return formatCurrency(value);
}

export default function PrintSalarySheetPage() {
  const { runId } = useParams<{ runId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: queryKeys.payrollSheetPrint(runId),
    queryFn: () => apiClient<PrintData>(`/payroll/runs/${runId}/print-data`, { token }),
    enabled: !!token && !!runId,
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
    ready: !!runId,
    isLoading,
    isPending,
    error,
    data,
  });

  if (loading) {
    return (
      <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing salary sheet…</p>
    );
  }

  if (showError || !data) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load salary sheet</p>;
  }

  const period = formatPeriod(data.run.year, data.run.month);
  const campus = data.run.branch?.name ?? 'Campus';
  const grouped = groupLines(data.run.lines);
  const grand = sumLines(data.run.lines);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A3 landscape;
            margin: 8mm;
          }
        }
        table.sheet {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        table.sheet th,
        table.sheet td {
          border: 1px solid #d4d4d8;
          padding: 4px 6px;
          text-align: right;
          white-space: nowrap;
        }
        table.sheet th:nth-child(2),
        table.sheet td:nth-child(2),
        table.sheet th:nth-child(4),
        table.sheet td:nth-child(4) {
          text-align: left;
        }
        table.sheet thead th {
          background: #f4f4f5;
          font-weight: 600;
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
      <div className="p-6 print:p-0">
        <PrintInstitutionHeader
          institution={data.institution}
          subtitle={`Salary sheet · ${campus} · ${period}`}
        />
        <p className="mb-4 text-center text-xs text-neutral-600">
          {isPayrollPaid(data.run)
            ? `Paid${data.run.paymentMethod ? ` · ${data.run.paymentMethod}` : ''}`
            : 'Open (unpaid)'}
        </p>

        {GROUPS.map((group) => {
          const rows = grouped[group];
          const totals = sumLines(rows);
          if (rows.length === 0) return null;
          return (
            <section key={group} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">
                {STAFF_GROUP_LABELS[group]}
              </h2>
              <GroupTable group={group} rows={rows} totals={totals} />
            </section>
          );
        })}

        <div className="mt-4 flex justify-end gap-8 border-t border-neutral-300 pt-3 text-sm font-semibold">
          <span>Grand total ({grand.count})</span>
          <span>Basic {money(grand.basicSalary)}</span>
          <span>Net {money(grand.netPay)}</span>
        </div>
      </div>
    </>
  );
}

function GroupTable({
  group,
  rows,
  totals,
}: {
  group: StaffGroup;
  rows: PayrollLine[];
  totals: ReturnType<typeof sumLines>;
}) {
  const visiting = group === 'visiting';
  const headers = visiting
    ? [
        'Sr',
        'Name',
        'Account',
        'Designation',
        'Basic',
        'Rate/class',
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
        'Net',
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
        'Absent fine',
        'Advance',
        'Security',
        'EOBI',
        'PESSI',
        'Net',
        'Pending adv',
        'Sec. till date',
        'Remarks',
      ];

  return (
    <table className="sheet">
      <thead>
        <tr>
          {headers.map((label) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((line, index) => (
          <tr key={line.id}>
            <td>{index + 1}</td>
            <td>{line.user?.fullName ?? '—'}</td>
            <td>{line.accountNumber ?? ''}</td>
            <td>{line.designation ?? ''}</td>
            <td>{money(line.basicSalary)}</td>
            {visiting ? (
              <>
                <td>{money(line.ratePerClass)}</td>
                <td>{line.lectureCount}</td>
                <td>{money(line.lecturesAmount)}</td>
                <td>{money(line.otherAllowance)}</td>
                <td>{line.absents}</td>
                <td>{line.deductedDays}</td>
              </>
            ) : (
              <>
                <td>{money(line.perDay)}</td>
                <td>{line.workingDays}</td>
                <td>{line.absents}</td>
                <td>{line.deductedDays}</td>
                <td>{line.extraLectures}</td>
                <td>{money(line.extraLecAmount)}</td>
                <td>{money(line.otherAllowance)}</td>
              </>
            )}
            <td>{money(line.absentFine)}</td>
            <td>{money(line.advanceDeduction)}</td>
            <td>{money(line.securityDeduct)}</td>
            <td>{money(line.eobi)}</td>
            <td>{money(line.pessi)}</td>
            <td>{money(line.netPay)}</td>
            {!visiting ? (
              <>
                <td>{money(line.pendingAdvance)}</td>
                <td>{money(line.securityTillDate)}</td>
              </>
            ) : null}
            <td>{line.remarks ?? ''}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4}>Total ({totals.count})</td>
          <td>{money(totals.basicSalary)}</td>
          <td colSpan={visiting ? 11 : 12} />
          <td>{money(totals.netPay)}</td>
          <td colSpan={visiting ? 1 : 3} />
        </tr>
      </tbody>
    </table>
  );
}
