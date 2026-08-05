'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface VoucherPrintData {
  voucher: {
    voucherNo: string;
    voucherType: string;
    voucherDate: string;
    narration: string | null;
    status: string;
    feeType: { id: string; code: string; name: string } | null;
    lines: Array<{
      account: { code: string; name: string };
      debit: number;
      credit: number;
      memo: string | null;
    }>;
  };
  institution: { name: string; logoUrl: string | null; address: string | null };
  template: PrintTemplateConfig;
}

export default function PrintAccountingVoucherPage() {
  const { voucherId } = useParams<{ voucherId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['accounting-voucher-print', voucherId],
    queryFn: () =>
      apiClient<VoucherPrintData>(`/accounting/vouchers/${voucherId}/print-data`, { token }),
    enabled: !!token && !!voucherId,
  });

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const t = data?.template;
  const { loading, error: showError } = printQueryUiState({
    authLoading,
    hasToken: !!token,
    ready: !!voucherId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Accounting voucher" template={t} loading={loading} error={showError}>
      {data ? (
        <article>
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle={`${data.voucher.voucherType} voucher`}
            headerText={t?.headerText}
          />
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <p>Voucher #: {data.voucher.voucherNo}</p>
            <p className="text-right">Date: {new Date(data.voucher.voucherDate).toLocaleDateString()}</p>
            <p>Status: {data.voucher.status}</p>
            <p className="text-right">Fee type: {data.voucher.feeType?.name ?? '—'}</p>
          </div>
          {fieldVisible(t, 'showNarration') && data.voucher.narration ? (
            <p className="mb-3 text-sm">Narration: {data.voucher.narration}</p>
          ) : null}
          <table className="mb-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-left">Account</th>
                <th className="py-1 text-right">Debit</th>
                <th className="py-1 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.voucher.lines.map((line, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1">
                    {line.account.code} — {line.account.name}
                    {line.memo ? <span className="block text-xs text-neutral-500">{line.memo}</span> : null}
                  </td>
                  <td className="py-1 text-right">{line.debit ? formatCurrency(line.debit) : ''}</td>
                  <td className="py-1 text-right">{line.credit ? formatCurrency(line.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fieldVisible(t, 'showPreparedBy') ? (
            <p className="mt-8 text-sm">Prepared by: ______________________</p>
          ) : null}
          <PrintFooter footerText={t?.footerText} extraNote={t?.extraNote} />
        </article>
      ) : null}
    </PrintShell>
  );
}
