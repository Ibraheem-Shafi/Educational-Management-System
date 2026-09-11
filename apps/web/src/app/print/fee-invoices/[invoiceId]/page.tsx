'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface InvoicePrintData {
  invoice: {
    invoiceNo: string | null;
    voucherNo: string | null;
    billingPeriod: string | null;
    amount: number;
    discount: number;
    fine: number;
    netAmount: number;
    dueDate: string | null;
    remarks: string | null;
    status: { code: string; label: string } | null;
    feeType: { name: string; code: string } | null;
  };
  student: {
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string | null;
    photographUrl: string | null;
    phone: string | null;
    program: string | null;
    batch: string | null;
    branch: { name: string; code: string } | null;
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

export default function PrintFeeInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['fee-invoice-print', invoiceId],
    queryFn: () => apiClient<InvoicePrintData>(`/fee-invoices/${invoiceId}/print-data`, { token }),
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
      {data ? (
        <article className="rounded border border-neutral-300 p-5">
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle="Fee Invoice / Challan"
            headerText={t?.headerText}
          />
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
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
            </div>
            <div className="text-right">
              <p>Invoice #: {data.invoice.invoiceNo ?? '—'}</p>
              <p>Voucher #: {data.invoice.voucherNo ?? '—'}</p>
              {data.invoice.billingPeriod ? <p>Period: {data.invoice.billingPeriod}</p> : null}
              {data.invoice.feeType ? <p>Fee: {data.invoice.feeType.name}</p> : null}
              {fieldVisible(t, 'showDueDate') && data.invoice.dueDate ? (
                <p>Due: {new Date(data.invoice.dueDate).toLocaleDateString()}</p>
              ) : null}
              {data.invoice.status ? <p>Status: {data.invoice.status.label}</p> : null}
            </div>
          </div>
          {fieldVisible(t, 'showStudentPhoto') && data.student.photographUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.student.photographUrl} alt="" className="mb-3 h-20 w-20 object-cover" />
          ) : null}
          <table className="mb-3 w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1">Amount</td>
                <td className="py-1 text-right">{formatCurrency(data.invoice.amount)}</td>
              </tr>
              {fieldVisible(t, 'showDiscount') ? (
                <tr className="border-b">
                  <td className="py-1">Discount</td>
                  <td className="py-1 text-right">{formatCurrency(data.invoice.discount)}</td>
                </tr>
              ) : null}
              {fieldVisible(t, 'showFine') ? (
                <tr className="border-b">
                  <td className="py-1">Fine</td>
                  <td className="py-1 text-right">{formatCurrency(data.invoice.fine)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="py-2 font-semibold">Net payable</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(data.invoice.netAmount)}</td>
              </tr>
            </tbody>
          </table>
          {fieldVisible(t, 'showRemarks') && data.invoice.remarks ? (
            <p className="mb-2 text-sm">Remarks: {data.invoice.remarks}</p>
          ) : null}
          <PrintFooter
            footerText={t?.footerText}
            extraNote={fieldVisible(t, 'showBankNote') ? t?.extraNote : null}
          />
        </article>
      ) : null}
    </PrintShell>
  );
}
