'use client';

import { formatCurrency } from '@eims/shared';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader } from '@/components/print/print-shell';

export interface FeeInvoicePrintData {
  invoice: {
    id?: string;
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
    lines?: Array<{ feeTypeId: string; label: string; amount: number }>;
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

export function FeeInvoiceSlip({
  data,
  compact,
}: {
  data: FeeInvoicePrintData;
  compact?: boolean;
}) {
  const t = data.template;
  const lines =
    data.invoice.lines && data.invoice.lines.length > 0
      ? data.invoice.lines
      : [{ feeTypeId: '', label: data.invoice.feeType?.name ?? 'Fee', amount: data.invoice.amount }];

  return (
    <article className={compact ? 'h-full overflow-hidden rounded border border-neutral-300 p-3 text-[11px] leading-tight' : 'rounded border border-neutral-300 p-5'}>
      <PrintInstitutionHeader
        institution={data.institution}
        showLogo={fieldVisible(t, 'showLogo')}
        subtitle="Fee Invoice / Challan"
        headerText={t?.headerText}
      />
      <div className={`mb-2 grid grid-cols-2 gap-2 ${compact ? 'text-[11px]' : 'mb-4 gap-3 text-sm'}`}>
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
          {fieldVisible(t, 'showDueDate') && data.invoice.dueDate ? (
            <p>Due: {new Date(data.invoice.dueDate).toLocaleDateString()}</p>
          ) : null}
          {data.invoice.status ? <p>Status: {data.invoice.status.label}</p> : null}
        </div>
      </div>
      {fieldVisible(t, 'showStudentPhoto') && data.student.photographUrl && !compact ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.student.photographUrl} alt="" className="mb-3 h-20 w-20 object-cover" />
      ) : null}
      <table className={`mb-2 w-full border-collapse ${compact ? 'text-[11px]' : 'mb-3 text-sm'}`}>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.feeTypeId}-${index}`} className="border-b">
              <td className="py-0.5">{line.label}</td>
              <td className="py-0.5 text-right">{formatCurrency(line.amount)}</td>
            </tr>
          ))}
          {fieldVisible(t, 'showDiscount') ? (
            <tr className="border-b">
              <td className="py-0.5">Discount</td>
              <td className="py-0.5 text-right">{formatCurrency(data.invoice.discount)}</td>
            </tr>
          ) : null}
          {fieldVisible(t, 'showFine') ? (
            <tr className="border-b">
              <td className="py-0.5">Fine</td>
              <td className="py-0.5 text-right">{formatCurrency(data.invoice.fine)}</td>
            </tr>
          ) : null}
          <tr>
            <td className={compact ? 'py-1 font-semibold' : 'py-2 font-semibold'}>Net payable</td>
            <td className={compact ? 'py-1 text-right font-semibold' : 'py-2 text-right font-semibold'}>
              {formatCurrency(data.invoice.netAmount)}
            </td>
          </tr>
        </tbody>
      </table>
      {fieldVisible(t, 'showRemarks') && data.invoice.remarks ? (
        <p className={compact ? 'mb-1 text-[10px]' : 'mb-2 text-sm'}>Remarks: {data.invoice.remarks}</p>
      ) : null}
      <PrintFooter
        footerText={t?.footerText}
        extraNote={fieldVisible(t, 'showBankNote') ? t?.extraNote : null}
      />
    </article>
  );
}
