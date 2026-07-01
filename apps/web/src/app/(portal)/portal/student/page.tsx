'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@eims/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';

const PORTAL_STUDENT_KEYS = ['portal-student'] as const;

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface StudentPortal {
  student: { fullName: string; batch?: { name: string }; program?: { name: string } } | null;
  message?: string;
  attendance: Array<{ date: string; status?: { label: string } | null }>;
  assessments: Array<{ assessment: string | null; grade: string | null; percentage: number | null }>;
  fees: { outstanding: number; invoices: Array<{ feeType?: { name: string }; netAmount: number; status?: { label: string } }> };
  notices?: Array<{ title: string; body: string }>;
  timetable?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  }>;
}

export default function StudentPortalPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  useNoticesRealtime(PORTAL_STUDENT_KEYS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-student'],
    queryFn: () => apiClient<StudentPortal>('/portal/student', { token }),
    enabled: !!token,
  });

  if (isLoading) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load portal.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student portal</h1>
        {data?.student && (
          <p className="text-muted-foreground">
            {data.student.fullName} · {data.student.program?.name ?? '—'} ·{' '}
            {data.student.batch?.name ?? '—'}
          </p>
        )}
      </div>

      {data?.message && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">{data.message}</CardContent>
        </Card>
      )}

      {data?.notices && data.notices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notices.map((n) => (
              <div key={n.title}>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data?.student && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Recent attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {data.attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.attendance.map((a, i) => (
                    <li key={i} className="break-words">
                      {a.date} — {a.status?.label ?? '—'}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              {data.assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.assessments.map((a, i) => (
                    <li key={i} className="break-words">
                      {a.assessment ?? 'Test'} — {a.grade ?? '—'}{' '}
                      {a.percentage != null ? `(${a.percentage}%)` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class timetable</CardTitle>
            </CardHeader>
            <CardContent>
              {!data.timetable?.length ? (
                <p className="text-sm text-muted-foreground">No timetable published</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.timetable.map((slot, i) => (
                    <li key={i} className="break-words">
                      {DAY_NAMES[slot.dayOfWeek] ?? slot.dayOfWeek} {slot.startTime}–{slot.endTime} ·{' '}
                      {slot.subjectName ?? '—'}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Fees · Outstanding {formatCurrency(data.fees.outstanding)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.fees.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.fees.invoices.map((f, i) => (
                    <li key={i} className="break-words">
                      {f.feeType?.name ?? 'Fee'} — {formatCurrency(f.netAmount)} ({f.status?.label})
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
