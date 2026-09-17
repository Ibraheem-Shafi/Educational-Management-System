'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PrintShell, printQueryUiState } from '@/components/print/print-shell';
import { FeeInvoiceSlip, type FeeInvoicePrintData } from '@/components/print/fee-invoice-slip';

function PrintFeeInvoicesBulkContent() {
  const searchParams = useSearchParams();
  const ids = useMemo(
    () =>
      (searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 90),
    [searchParams],
  );
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['fee-invoice-print-bulk', ids.join(',')],
    queryFn: () =>
      apiClient<{ invoices: FeeInvoicePrintData[] }>(
        `/fee-invoices/print-data?ids=${encodeURIComponent(ids.join(','))}`,
        { token },
      ),
    enabled: !!token && ids.length > 0,
  });

  useEffect(() => {
    if (data?.invoices.length) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const t = data?.invoices[0]?.template;
  const { loading, error: showError } = printQueryUiState({
    authLoading,
    hasToken: !!token,
    ready: ids.length > 0,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Fee invoices (3 per A4)" template={t} loading={loading} error={showError}>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        .bulk-slip {
          height: 88mm;
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>
      <div className="grid grid-cols-1 gap-2">
        {(data?.invoices ?? []).map((row) => (
          <div key={row.invoice.id ?? `${row.invoice.invoiceNo}-${row.student.fullName}`} className="bulk-slip">
            <FeeInvoiceSlip data={row} compact />
          </div>
        ))}
      </div>
    </PrintShell>
  );
}

export default function PrintFeeInvoicesBulkPage() {
  return (
    <Suspense fallback={<PrintShell title="Fee invoices (3 per A4)" loading />}>
      <PrintFeeInvoicesBulkContent />
    </Suspense>
  );
}
