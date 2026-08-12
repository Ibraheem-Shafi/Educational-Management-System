'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface ChallanPrintData {
  challan: {
    challanNo: string | null;
    billingPeriod: string;
    monthLabel: string;
    dueDate: string | null;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    sessionLabel: string;
    amountInWords: string;
    fineNote: string;
    lines: Array<{ code: string; label: string; amount: number }>;
  };
  student: {
    fullName: string;
    fatherName: string | null;
    rollNumber: string | null;
    admissionNumber: string | null;
    className: string | null;
    branch: { name: string; code: string } | null;
  };
  paymentHistory: Array<{
    period: string;
    monthShort: string;
    status: string;
  }>;
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
}

const LINE_ORDER = ['monthly', 'arrears', 'admission', 'registration', 'annual', 'party', 'security'];

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function ChallanCopy({
  data,
  copyLabel,
}: {
  data: ChallanPrintData;
  copyLabel: string;
}) {
  const lineMap = new Map(data.challan.lines.map((l) => [l.code, l.amount]));
  const rows = LINE_ORDER.filter((code) =>
    ['monthly', 'arrears', 'admission', 'registration', 'annual', 'party'].includes(code),
  ).map((code, idx) => {
    const labels: Record<string, string> = {
      monthly: 'Monthly Fee',
      arrears: 'Arrears',
      admission: 'Admission Fee',
      registration: 'Registration Fee',
      annual: 'Annual Charges',
      party: 'Party Charges',
      security: 'Security Fee',
    };
    return {
      sr: idx + 1,
      label: labels[code] ?? code,
      amount: lineMap.get(code) ?? 0,
    };
  });

  const historyLeft = data.paymentHistory.slice(0, 6);
  const historyRight = data.paymentHistory.slice(6);

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-neutral-800 p-2 text-[10px] leading-tight text-black">
      <div className="mb-1 flex items-start justify-between gap-2 border-b border-neutral-700 pb-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">{data.institution.name}</p>
          {data.student.branch ? <p className="text-[9px]">{data.student.branch.name}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-semibold">{copyLabel}</p>
          <p>
            Challan No. <span className="font-bold">{data.challan.challanNo ?? '—'}</span>
          </p>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-[1.2fr_0.8fr] gap-2">
        <div className="space-y-0.5">
          <p>
            <span className="font-semibold">Student Name:</span> {data.student.fullName}
          </p>
          <p>
            <span className="font-semibold">Father Name:</span> {data.student.fatherName ?? '—'}
          </p>
          <p>
            <span className="font-semibold">Roll No.:</span> {data.student.rollNumber ?? data.student.admissionNumber ?? '—'}
          </p>
          <p>
            <span className="font-semibold">Class:</span> {data.student.className ?? '—'}
          </p>
          <p>
            <span className="font-semibold">Month:</span> {data.challan.monthLabel}
          </p>
          <p>
            <span className="font-semibold">Due Date:</span> {formatDueDate(data.challan.dueDate)}
          </p>
        </div>

        <div className="border border-neutral-700 p-1">
          <p className="mb-0.5 text-center font-semibold">Fee Payment History</p>
          <p className="mb-1 text-center text-[8px]">At the time of Admission Session {data.challan.sessionLabel}</p>
          <div className="grid grid-cols-2 gap-x-1">
            <div>
              {historyLeft.map((h) => (
                <p key={h.period} className="flex justify-between gap-1">
                  <span>{h.monthShort}</span>
                  <span className="font-semibold">
                    {h.status === 'paid' ? '✓' : h.status === 'partial' ? '½' : h.status === 'none' ? '' : '—'}
                  </span>
                </p>
              ))}
            </div>
            <div>
              {historyRight.map((h) => (
                <p key={h.period} className="flex justify-between gap-1">
                  <span>{h.monthShort}</span>
                  <span className="font-semibold">
                    {h.status === 'paid' ? '✓' : h.status === 'partial' ? '½' : h.status === 'none' ? '' : '—'}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <table className="mb-1 w-full border-collapse border border-neutral-800">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-800 px-1 py-0.5 text-left">Sr.</th>
            <th className="border border-neutral-800 px-1 py-0.5 text-left">Particulars</th>
            <th className="border border-neutral-800 px-1 py-0.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sr}>
              <td className="border border-neutral-800 px-1 py-0.5">{r.sr}</td>
              <td className="border border-neutral-800 px-1 py-0.5">{r.label}</td>
              <td className="border border-neutral-800 px-1 py-0.5 text-right">
                {r.amount > 0 ? formatCurrency(r.amount) : ''}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border border-neutral-800 px-1 py-0.5" colSpan={2}>
              Grand Total
            </td>
            <td className="border border-neutral-800 px-1 py-0.5 text-right">
              {formatCurrency(data.challan.grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mb-1">
        <span className="font-semibold">Amount in words:</span> {data.challan.amountInWords}
      </p>
      <div className="mb-1 flex justify-between gap-2">
        <p>
          <span className="font-semibold">Paid Amount:</span>{' '}
          {data.challan.paidAmount > 0 ? formatCurrency(data.challan.paidAmount) : '_______________'}
        </p>
        <p>
          <span className="font-semibold">Signature:</span> _______________
        </p>
      </div>
      <p className="mb-1 text-[8px]">{data.challan.fineNote}</p>
      <div className="mt-auto flex items-end justify-between pt-2">
        <p className="text-sm font-bold tracking-widest">SWC</p>
        <div className="flex h-10 w-16 items-center justify-center border border-dashed border-neutral-600 text-[8px]">
          School Stamp
        </div>
      </div>
    </section>
  );
}

export default function PrintFeeChallanPage() {
  const { challanId } = useParams<{ challanId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['fee-challan-print', challanId],
    queryFn: () => apiClient<ChallanPrintData>(`/fee-challans/${challanId}/print-data`, { token }),
    enabled: !!token && !!challanId,
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
    ready: !!challanId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Fee challan" loading={loading} error={showError}>
      {data ? (
        <div className="mx-auto flex w-full max-w-[1100px] gap-2 print:max-w-none">
          <style>{`
            @page { size: A4 landscape; margin: 8mm; }
            @media print {
              body { background: white !important; }
            }
          `}</style>
          <ChallanCopy data={data} copyLabel="School Copy" />
          <ChallanCopy data={data} copyLabel="Bank Copy" />
          <ChallanCopy data={data} copyLabel="Student Copy" />
        </div>
      ) : null}
    </PrintShell>
  );
}
