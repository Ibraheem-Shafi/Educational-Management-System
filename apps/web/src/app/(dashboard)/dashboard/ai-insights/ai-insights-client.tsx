'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

interface AtRiskStudent {
  studentId: string;
  fullName: string;
  attendanceRate: number | null;
  averagePercentage: number | null;
  reasons: string[];
  riskLevel: string;
}

interface StudentSummary {
  narrative: string;
  overallPercentage: number | null;
  recommendations: Array<{ subject: string; tip: string }>;
}

export default function AiInsightsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: atRisk } = useQuery({
    queryKey: ['ai-insights-at-risk'],
    queryFn: () =>
      apiClient<{ students: AtRiskStudent[] }>('/ai-insights/at-risk', { token }),
    enabled: !!token,
  });

  const { data: summary } = useQuery({
    queryKey: ['ai-insights-summary', selectedId],
    queryFn: () => apiClient<StudentSummary>(`/ai-insights/students/${selectedId}/summary`, { token }),
    enabled: !!token && !!selectedId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="At-risk detection and performance summaries" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>At-risk students ({atRisk?.students.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {atRisk?.students.map((s) => (
              <div key={s.studentId} className="flex items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.fullName}</p>
                  <p className="text-muted-foreground">{s.reasons.join(' · ')}</p>
                  <span
                    className={`text-xs font-medium ${s.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {s.riskLevel} risk
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedId(s.studentId)}>
                  Summary
                </Button>
              </div>
            ))}
            {atRisk?.students.length === 0 && (
              <p className="py-4 text-muted-foreground">No at-risk students detected</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!selectedId && <p className="text-muted-foreground">Select a student to view AI summary</p>}
            {summary && (
              <>
                <p>{summary.narrative}</p>
                {summary.overallPercentage !== null && (
                  <p className="font-medium">Overall: {summary.overallPercentage}%</p>
                )}
                {summary.recommendations.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium">Recommendations</p>
                    <ul className="space-y-2">
                      {summary.recommendations.map((r, i) => (
                        <li key={i}>
                          <span className="font-medium">{r.subject}:</span> {r.tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
