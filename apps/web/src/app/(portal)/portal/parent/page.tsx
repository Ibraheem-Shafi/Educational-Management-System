'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@eims/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';

const PORTAL_PARENT_KEYS = ['portal-parent'] as const;

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ChildData {
  student: { fullName: string };
  relationshipCode: string;
  attendance?: Array<{ date: string; status?: { label: string } | null }>;
  assessments: Array<{ assessment: string | null; grade: string | null; percentage: number | null }>;
  fees: {
    outstanding: number;
    recent: Array<{ feeType?: { name: string }; netAmount: number; status?: { label: string } }>;
  };
  timetable?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  }>;
}

interface ParentPortal {
  parent: { fullName: string } | null;
  message?: string;
  notices?: Array<{ title: string; body: string; publishedAt: string | null }>;
  children: Array<ChildData>;
}

interface ParentAiSummary {
  children: Array<{
    student: { fullName: string };
    narrative: string;
    overallPercentage: number | null;
    recommendations: Array<{ subject: string; tip: string }>;
  }>;
}

function ChildCard({
  child,
  aiChild,
}: {
  child: ChildData;
  aiChild?: ParentAiSummary['children'][number];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {child.student.fullName}{' '}
          <span className="text-sm font-normal text-muted-foreground">({child.relationshipCode})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {aiChild && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="mb-1 text-sm font-medium">AI performance summary</p>
            <p className="text-sm text-muted-foreground">{aiChild.narrative}</p>
            {aiChild.overallPercentage !== null && (
              <p className="mt-2 text-sm font-medium">Overall: {aiChild.overallPercentage}%</p>
            )}
            {aiChild.recommendations.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {aiChild.recommendations.map((r, i) => (
                    <li key={i} className="break-words">
                    <span className="font-medium">{r.subject}:</span> {r.tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">Recent attendance</p>
          {(child.attendance?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {child.attendance?.map((a, i) => (
                    <li key={i} className="break-words">
                  {a.date} — {a.status?.label ?? '—'}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Recent assessments</p>
          {child.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {child.assessments.map((a, i) => (
                    <li key={i} className="break-words">
                  {a.assessment ?? 'Test'} — {a.grade ?? '—'}{' '}
                  {a.percentage != null ? `(${a.percentage}%)` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Class timetable</p>
          {(child.timetable?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No timetable published</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {child.timetable?.map((slot, i) => (
                    <li key={i} className="break-words">
                  {DAY_NAMES[slot.dayOfWeek] ?? slot.dayOfWeek} {slot.startTime}–{slot.endTime} ·{' '}
                  {slot.subjectName ?? '—'}
                  {slot.room ? ` · ${slot.room}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            Fees · Outstanding {formatCurrency(child.fees.outstanding)}
          </p>
          {child.fees.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {child.fees.recent.map((f, i) => (
                    <li key={i} className="break-words">
                  {f.feeType?.name ?? 'Fee'} — {formatCurrency(f.netAmount)} ({f.status?.label})
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParentPortalPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  useNoticesRealtime(PORTAL_PARENT_KEYS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortal>('/portal/parent', { token }),
    enabled: !!token,
  });

  const { data: aiSummary } = useQuery({
    queryKey: ['portal-parent-ai-summary'],
    queryFn: () => apiClient<ParentAiSummary>('/ai-insights/portal/parent-summary', { token }),
    enabled: !!token,
  });

  if (isLoading) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load portal.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parent portal</h1>
        <p className="text-muted-foreground">
          Welcome{data?.parent ? `, ${data.parent.fullName}` : ''}
        </p>
      </div>

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

      {data?.message && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">{data.message}</CardContent>
        </Card>
      )}

      {data?.children.map((child) => (
        <ChildCard
          key={child.student.fullName}
          child={child}
          aiChild={aiSummary?.children.find((c) => c.student.fullName === child.student.fullName)}
        />
      ))}
    </div>
  );
}
