'use client';

import { useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface ReportCardRecord {
  id: string;
  assessmentName: string | null;
  subject: string | null;
  obtainedMarks: number | null;
  totalMarks: number | null;
  percentage: number | null;
  grade: string | null;
  rank: number | null;
  remarks: string | null;
  publishedAt: string | null;
}

interface ReportCardResponse {
  student: {
    id: string;
    fullName: string;
    batch?: { name: string } | null;
    program?: { name: string } | null;
  };
  records: ReportCardRecord[];
}

export default function ReportCardPrintPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { session } = useAuth();
  const token = session?.access_token;
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('assessmentId');

  const queryString = new URLSearchParams({
    studentId,
    ...(assessmentId ? { assessmentId } : {}),
  }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-card', studentId, assessmentId],
    queryFn: () => apiClient<ReportCardResponse>(`/report-cards?${queryString}`, { token }),
    enabled: !!token && !!studentId,
  });

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (isLoading) {
    return <p className="p-8 text-sm text-[var(--text-sub-500)]">Loading report card…</p>;
  }

  if (error || !data) {
    return <p className="p-8 text-sm text-red-600">Unable to load report card.</p>;
  }

  const { student, records } = data;

  return (
    <div className="report-card-print min-h-screen bg-white font-[family-name:var(--font-inter)] text-[var(--text-main-900)]">
      <div className="no-print flex items-center justify-between border-b border-[var(--stroke-soft-200,#E2E4E9)] px-6 py-4">
        <p className="text-sm text-[var(--text-sub-500)]">Report card preview</p>
        <Button type="button" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-10">
        <header className="mb-8 border-b border-[var(--stroke-soft-200,#E2E4E9)] pb-6 text-center">
          <h1 className="text-2xl font-semibold">Report Card</h1>
          <p className="mt-2 text-lg">{student.fullName}</p>
          <p className="mt-1 text-sm text-[var(--text-sub-500)]">
            {[student.program?.name, student.batch?.name].filter(Boolean).join(' · ') || '—'}
          </p>
        </header>

        {records.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-sub-500)]">
            No published assessment records found.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke-soft-200,#E2E4E9)]">
                <th className="py-2 text-left font-medium">Assessment</th>
                <th className="py-2 text-left font-medium">Subject</th>
                <th className="py-2 text-right font-medium">Marks</th>
                <th className="py-2 text-right font-medium">%</th>
                <th className="py-2 text-right font-medium">Grade</th>
                <th className="py-2 text-right font-medium">Rank</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-[var(--stroke-soft-200,#E2E4E9)]">
                  <td className="py-3 pr-4">{record.assessmentName ?? '—'}</td>
                  <td className="py-3 pr-4">{record.subject ?? '—'}</td>
                  <td className="py-3 text-right">
                    {record.obtainedMarks != null && record.totalMarks != null
                      ? `${record.obtainedMarks} / ${record.totalMarks}`
                      : '—'}
                  </td>
                  <td className="py-3 text-right">
                    {record.percentage != null ? `${record.percentage}%` : '—'}
                  </td>
                  <td className="py-3 text-right">{record.grade ?? '—'}</td>
                  <td className="py-3 text-right">{record.rank ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="mt-10 text-center text-xs text-[var(--text-sub-500)]">
          Generated on {new Date().toLocaleDateString()}
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .report-card-print {
            min-height: auto;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
}
