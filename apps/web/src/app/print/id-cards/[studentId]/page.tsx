'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { UserAvatar } from '@/components/layout/user-avatar';

interface IdCardPrintData {
  student: {
    id: string;
    fullName: string;
    dateOfBirth: string | null;
    cnicOrBForm: string | null;
    photographUrl: string | null;
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
}

export default function PrintIdCardPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, error } = useQuery({
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

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing ID card…</p>;
  }

  if (error || !data) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load ID card</p>;
  }

  const { student, institution } = data;

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
            <UserAvatar
              name={student.fullName}
              src={student.photographUrl}
              seed={student.id}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="truncate text-base font-semibold text-[var(--text-main-900)]">{student.fullName}</p>
              <p className="text-[var(--text-sub-500,#525866)]">{student.program ?? '—'}</p>
              <p className="text-[var(--text-sub-500,#525866)]">{student.batch ?? '—'}</p>
              {student.cnicOrBForm && (
                <p className="font-mono text-xs text-[var(--text-sub-500,#525866)]">{student.cnicOrBForm}</p>
              )}
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
