'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';
import { formatCalendarDate } from '@/lib/date-utils';

interface ReceiptPrintData {
  payment: {
    receiptNo: string | null;
    amount: number;
    method: string;
    providerRef?: string | null;
    paidAt: string | null;
  };
  invoice: {
    invoiceNo: string | null;
    voucherNo: string | null;
    billingPeriod: string | null;
    feeType: { name: string; code: string } | null;
  };
  student: {
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string | null;
    program: string | null;
    batch: string | null;
  };
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  template: PrintTemplateConfig & { name?: string };
}

export default function PrintFeeReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['fee-receipt-print', paymentId],
    queryFn: () => apiClient<ReceiptPrintData>(`/fee-payments/${paymentId}/print-data`, { token }),
    enabled: !!token && !!paymentId,
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
    ready: !!paymentId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Fee payment receipt" template={t} loading={loading} error={showError}>
      {data ? (
        <article className="rounded border border-neutral-300 p-4">
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle="Payment Receipt"
            headerText={t?.headerText}
          />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{data.student.fullName}</p>
            {fieldVisible(t, 'showRollNumber') && data.student.rollNumber ? (
              <p>Roll #: {data.student.rollNumber}</p>
            ) : null}
            {fieldVisible(t, 'showAdmissionNumber') && data.student.admissionNumber ? (
              <p>Admission #: {data.student.admissionNumber}</p>
            ) : null}
            {fieldVisible(t, 'showProgram') && data.student.program ? (
              <p>Program: {data.student.program}</p>
            ) : null}
            {fieldVisible(t, 'showBatch') && data.student.batch ? <p>Batch: {data.student.batch}</p> : null}
            <hr className="my-2" />
            <p>Receipt #: {data.payment.receiptNo ?? '—'}</p>
            {fieldVisible(t, 'showInvoiceRef') ? <p>Invoice #: {data.invoice.invoiceNo ?? '—'}</p> : null}
            <p>Voucher #: {data.invoice.voucherNo ?? '—'}</p>
            {data.invoice.billingPeriod ? <p>Period: {data.invoice.billingPeriod}</p> : null}
            {data.invoice.feeType ? <p>Fee: {data.invoice.feeType.name}</p> : null}
            <p className="text-base font-semibold">Paid: {formatCurrency(data.payment.amount)}</p>
            {fieldVisible(t, 'showPaymentMethod') ? <p>Method: {data.payment.method}</p> : null}
            {data.payment.providerRef ? <p>Reference: {data.payment.providerRef}</p> : null}
            {data.payment.paidAt ? <p>Date: {formatCalendarDate(data.payment.paidAt)}</p> : null}
          </div>
          <PrintFooter footerText={t?.footerText} extraNote={t?.extraNote} />
        </article>
      ) : null}
    </PrintShell>
  );
}
