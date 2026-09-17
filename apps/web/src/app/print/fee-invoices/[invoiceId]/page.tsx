'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PrintShell, printQueryUiState } from '@/components/print/print-shell';
import { FeeInvoiceSlip, type FeeInvoicePrintData } from '@/components/print/fee-invoice-slip';

export default function PrintFeeInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['fee-invoice-print', invoiceId],
    queryFn: () => apiClient<FeeInvoicePrintData>(`/fee-invoices/${invoiceId}/print-data`, { token }),
    enabled: !!token && !!invoiceId,
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
    ready: !!invoiceId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Fee invoice / challan" template={t} loading={loading} error={showError}>
      {data ? <FeeInvoiceSlip data={data} /> : null}
    </PrintShell>
  );
}
