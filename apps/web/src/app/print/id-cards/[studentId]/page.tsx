'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { printQueryUiState } from '@/components/print/print-shell';
import { UserAvatar } from '@/components/layout/user-avatar';

interface IdCardPrintData {
  student: {
    id: string;
    fullName: string;
    dateOfBirth: string | null;
    cnicOrBForm: string | null;
    photographUrl: string | null;
    rollNumber?: string | null;
    admissionNumber?: string | null;
    program: string | null;
    batch: string | null;
    branch: { name: string; code: string } | null;
  };
  institution: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  printLayout?: {
    paperSize?: string;
    fields?: Record<string, boolean>;
  };
}

export default function PrintIdCardPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['id-card-print', studentId],
    queryFn: () => apiClient<IdCardPrintData>(`/certificates/id-cards/${studentId}/print-data`, { token }),
    enabled: !!token && !!studentId,
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
    ready: !!studentId,
    isLoading,
    isPending,
    error,
    data,
  });

  if (loading) {
    return <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing ID card…</p>;
  }

  if (showError || !data) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load ID card</p>;
  }

  const { student, institution, printLayout } = data;
  const fields = printLayout?.fields ?? {};
  const show = (key: string, fallback = true) =>
    key in fields ? Boolean(fields[key]) : fallback;

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: 85.6mm 54mm;
            margin: 4mm;
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 print:min-h-0 print:p-0">
        <div className="w-[340px] overflow-hidden rounded-xl border-2 border-[var(--midnight-blue-950,#01366C)] bg-white shadow-lg print:shadow-none">
          <div className="bg-[var(--midnight-blue-950,#01366C)] px-4 py-3 text-center text-white">
            <p className="text-xs uppercase tracking-wide opacity-90">{institution.name}</p>
            <p className="text-sm font-semibold">Student ID Card</p>
          </div>
          <div className="flex gap-4 p-4">
            {show('showPhoto') ? (
              <UserAvatar
                name={student.fullName}
                src={student.photographUrl}
                seed={student.id}
                size="lg"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="truncate text-base font-semibold text-[var(--text-main-900)]">{student.fullName}</p>
              {show('showRollNumber') && student.rollNumber ? (
                <p className="font-medium">Roll #: {student.rollNumber}</p>
              ) : null}
              {show('showAdmissionNumber') && student.admissionNumber ? (
                <p className="text-xs">Adm #: {student.admissionNumber}</p>
              ) : null}
              {show('showProgram') ? (
                <p className="text-[var(--text-sub-500,#525866)]">{student.program ?? '—'}</p>
              ) : null}
              {show('showBatch') ? (
                <p className="text-[var(--text-sub-500,#525866)]">{student.batch ?? '—'}</p>
              ) : null}
              {show('showCnic') && student.cnicOrBForm ? (
                <p className="font-mono text-xs text-[var(--text-sub-500,#525866)]">{student.cnicOrBForm}</p>
              ) : null}
            </div>
          </div>
          <div className="border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2 text-center text-xs text-[var(--text-sub-500,#525866)]">
            {student.branch?.name ?? institution.name}
            {institution.phone ? ` · ${institution.phone}` : ''}
          </div>
        </div>
      </div>
    </>
  );
}
