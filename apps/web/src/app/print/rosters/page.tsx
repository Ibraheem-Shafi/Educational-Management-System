'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { fieldVisible, type PrintTemplateConfig } from '@/lib/print-template';
import { PrintFooter, PrintInstitutionHeader, PrintShell, printQueryUiState } from '@/components/print/print-shell';

interface RosterData {
  batch: { name: string; program: string | null; branch: { name: string } | null };
  students: Array<{
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string | null;
    phone: string | null;
    status: string | null;
  }>;
  institution: { name: string; logoUrl: string | null; address: string | null };
  template: PrintTemplateConfig;
}

function PrintRosterContent() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') ?? '';
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['roster-print', batchId],
    queryFn: () => apiClient<RosterData>(`/students/rosters/${batchId}/print-data`, { token }),
    enabled: !!token && !!batchId,
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
    ready: !!batchId,
    isLoading,
    isPending,
    error,
    data,
  });

  return (
    <PrintShell title="Student roster" template={t} loading={loading} error={showError}>
      {data ? (
        <article>
          <PrintInstitutionHeader
            institution={data.institution}
            showLogo={fieldVisible(t, 'showLogo')}
            subtitle={`Roster — ${data.batch.name}`}
            headerText={t?.headerText}
          />
          <p className="mb-3 text-sm">
            {[data.batch.program, data.batch.branch?.name].filter(Boolean).join(' · ')}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {fieldVisible(t, 'showRollNumber') ? <th className="py-1 text-left">Roll</th> : null}
                <th className="py-1 text-left">Name</th>
                {fieldVisible(t, 'showAdmissionNumber') ? (
                  <th className="py-1 text-left">Admission</th>
                ) : null}
                {fieldVisible(t, 'showPhone') ? <th className="py-1 text-left">Phone</th> : null}
                {fieldVisible(t, 'showStatus') ? <th className="py-1 text-left">Status</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  {fieldVisible(t, 'showRollNumber') ? <td className="py-1">{s.rollNumber ?? '—'}</td> : null}
                  <td className="py-1">{s.fullName}</td>
                  {fieldVisible(t, 'showAdmissionNumber') ? (
                    <td className="py-1">{s.admissionNumber ?? '—'}</td>
                  ) : null}
                  {fieldVisible(t, 'showPhone') ? <td className="py-1">{s.phone ?? '—'}</td> : null}
                  {fieldVisible(t, 'showStatus') ? <td className="py-1">{s.status ?? '—'}</td> : null}
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

export default function PrintRosterPage() {
  return (
    <Suspense fallback={<PrintShell title="Student roster" loading />}>
      <PrintRosterContent />
    </Suspense>
  );
}
