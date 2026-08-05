'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface RollSlipData {
  student: {
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string | null;
    photographUrl: string | null;
    cnicOrBForm: string | null;
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
  template: PrintTemplateConfig;
}

export default function PrintRollSlipPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['roll-slip-print', studentId],
    queryFn: () => apiClient<RollSlipData>(`/students/${studentId}/roll-slip/print-data`, { token }),
    enabled: !!token && !!studentId,
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
    ready: !!studentId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Roll number slip" template={t} loading={loading} error={showError}>
      {data ? (
        <article className="rounded border border-neutral-300 p-5">
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle="Roll Number Slip"
            headerText={t?.headerText}
          />
          <div className="flex gap-4">
            {fieldVisible(t, 'showPhoto') && data.student.photographUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.student.photographUrl} alt="" className="h-28 w-24 object-cover" />
            ) : null}
            <div className="space-y-1 text-sm">
              <p className="text-lg font-semibold">{data.student.fullName}</p>
              {fieldVisible(t, 'showRollNumber') ? (
                <p className="text-base font-medium">Roll #: {data.student.rollNumber ?? '—'}</p>
              ) : null}
              {fieldVisible(t, 'showAdmissionNumber') ? (
                <p>Admission #: {data.student.admissionNumber ?? '—'}</p>
              ) : null}
              {fieldVisible(t, 'showProgram') && data.student.program ? (
                <p>Program: {data.student.program}</p>
              ) : null}
              {fieldVisible(t, 'showBatch') && data.student.batch ? <p>Batch: {data.student.batch}</p> : null}
              {fieldVisible(t, 'showBranch') && data.student.branch ? (
                <p>Branch: {data.student.branch.name}</p>
              ) : null}
              {fieldVisible(t, 'showCnic') && data.student.cnicOrBForm ? (
                <p>CNIC/B-Form: {data.student.cnicOrBForm}</p>
              ) : null}
              {fieldVisible(t, 'showPhone') && data.student.phone ? <p>Phone: {data.student.phone}</p> : null}
            </div>
          </div>
          <PrintFooter footerText={t?.footerText} extraNote={t?.extraNote} />
        </article>
      ) : null}
    </PrintShell>
  );
}
