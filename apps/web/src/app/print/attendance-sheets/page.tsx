'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface SheetData {
  date: string;
  batchName: string;
  students: Array<{
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string | null;
    attendance: { status: { label: string } | null } | null;
  }>;
  institution: { name: string; logoUrl: string | null; address: string | null };
  template: PrintTemplateConfig;
}

export default function PrintAttendanceSheetPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') ?? '';
  const date = searchParams.get('date') ?? '';
  const branchId = searchParams.get('branchId') ?? '';
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const qs = new URLSearchParams({ batchId, date, ...(branchId ? { branchId } : {}) });

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['attendance-sheet-print', batchId, date, branchId],
    queryFn: () => apiClient<SheetData>(`/attendance/sheet/print-data?${qs.toString()}`, { token }),
    enabled: !!token && !!batchId && !!date,
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
    ready: !!batchId && !!date,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Attendance sheet" template={t} loading={loading} error={showError}>
      {data ? (
        <article>
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle={`Attendance — ${data.batchName}`}
            headerText={t?.headerText}
          />
          <p className="mb-3 text-sm">Date: {new Date(data.date).toLocaleDateString()}</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {fieldVisible(t, 'showRollNumber') ? <th className="py-1 text-left">Roll</th> : null}
                <th className="py-1 text-left">Name</th>
                {fieldVisible(t, 'showAdmissionNumber') ? (
                  <th className="py-1 text-left">Admission</th>
                ) : null}
                <th className="py-1 text-left">Status</th>
                {fieldVisible(t, 'showSignatureColumn') ? (
                  <th className="py-1 text-left">Signature</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  {fieldVisible(t, 'showRollNumber') ? <td className="py-2">{s.rollNumber ?? '—'}</td> : null}
                  <td className="py-2">{s.fullName}</td>
                  {fieldVisible(t, 'showAdmissionNumber') ? (
                    <td className="py-2">{s.admissionNumber ?? '—'}</td>
                  ) : null}
                  <td className="py-2">{s.attendance?.status?.label ?? ''}</td>
                  {fieldVisible(t, 'showSignatureColumn') ? <td className="py-2">&nbsp;</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <PrintFooter footerText={t?.footerText} />
        </article>
      ) : null}
    </PrintShell>
  );
}
