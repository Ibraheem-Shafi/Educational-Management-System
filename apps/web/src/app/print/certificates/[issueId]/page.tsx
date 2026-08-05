'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { printQueryUiState } from '@/components/print/print-shell';

interface PrintData {
  issue: { title: string; serialNo: string | null; issuedAt: string };
  template: { type: string; name: string };
  student: {
    fullName: string;
    program: string | null;
    batch: string | null;
    gender: string | null;
    cnicOrBForm: string | null;
    dateOfBirth: string | null;
    branch: { name: string } | null;
  };
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
  };
}

function headingForType(type: string): string {
  switch (type) {
    case 'transfer_certificate':
      return 'Transfer Certificate';
    case 'character_certificate':
      return 'Character Certificate';
    case 'completion_certificate':
    default:
      return 'Certificate of Completion';
  }
}

function bodyForType(type: string, student: PrintData['student']): string {
  const programBit = student.program ? ` in ${student.program}` : '';
  const batchBit = student.batch ? ` (${student.batch})` : '';
  const branchBit = student.branch ? ` at ${student.branch.name}` : '';

  switch (type) {
    case 'transfer_certificate':
      return `was a bonafide student${programBit}${batchBit}${branchBit} and is hereby granted this Transfer Certificate on request. All dues have been cleared to the best of our knowledge.`;
    case 'character_certificate':
      return `is / was a student${programBit}${batchBit}${branchBit}. During the period of association with this institution, their conduct and character have been found to be good / satisfactory.`;
    case 'completion_certificate':
    default:
      return `has successfully completed the program${programBit}${batchBit}${branchBit}.`;
  }
}

export default function PrintCertificatePage() {
  const { issueId } = useParams<{ issueId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['certificate-print', issueId],
    queryFn: () => apiClient<PrintData>(`/certificates/issues/${issueId}/print-data`, { token }),
    enabled: !!token && !!issueId,
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
    ready: !!issueId,
    isLoading,
    isPending,
    error,
    data,
  });

  if (loading) {
    return <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing certificate…</p>;
  }

  if (showError || !data) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load certificate</p>;
  }

  const issuedDate = new Date(data.issue.issuedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const certType = data.template.type;
  const heading = headingForType(certType);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
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
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center p-8 text-center print:min-h-0 print:p-0">
        <div className="w-full rounded-2xl border-4 border-[var(--midnight-blue-950,#01366C)] px-10 py-12">
          {data.institution.logoUrl && !data.institution.logoUrl.startsWith('storage://') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.institution.logoUrl} alt="" className="mx-auto mb-4 h-16 object-contain" />
          )}
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-sub-500,#525866)]">
            {data.institution.name}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--midnight-blue-950,#01366C)]">
            {heading}
          </h1>
          <p className="mt-6 text-base text-[var(--text-sub-500,#525866)]">This is to certify that</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--text-main-900)]">{data.student.fullName}</p>
          {(data.student.cnicOrBForm || data.student.dateOfBirth) && (
            <p className="mt-2 text-sm text-[var(--text-sub-500,#525866)]">
              {data.student.cnicOrBForm ? `CNIC/B-Form: ${data.student.cnicOrBForm}` : ''}
              {data.student.cnicOrBForm && data.student.dateOfBirth ? ' · ' : ''}
              {data.student.dateOfBirth ? `DOB: ${data.student.dateOfBirth}` : ''}
            </p>
          )}
          <p className="mt-6 max-w-2xl mx-auto text-base leading-relaxed text-[var(--text-sub-500,#525866)]">
            {bodyForType(certType, data.student)}
          </p>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 text-left text-sm">
            <div>
              <p className="text-[var(--text-sub-500,#525866)]">Issued on</p>
              <p className="mt-1 font-medium">{issuedDate}</p>
            </div>
            {data.issue.serialNo && (
              <div>
                <p className="text-[var(--text-sub-500,#525866)]">Serial no.</p>
                <p className="mt-1 font-medium">{data.issue.serialNo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
