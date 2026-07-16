export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const PORTAL_STUDENT_KEY = ['portal-student'] as const;
export const PORTAL_PARENT_KEY = ['portal-parent'] as const;

export interface StudentPortalData {
  student: {
    id: string;
    fullName: string;
    batch?: { name: string } | null;
    program?: { name: string } | null;
  } | null;
  message?: string;
  attendance: Array<{ date: string; status?: { label: string; code?: string } | null }>;
  assessments: Array<{
    assessment: string | null;
    grade: string | null;
    percentage: number | null;
  }>;
  fees: {
    outstanding: number;
    invoices: Array<{
      feeType?: { name: string };
      netAmount: number;
      status?: { label: string; code?: string };
    }>;
  };
  notices?: Array<{ title: string; body: string; publishedAt?: string | null }>;
  timetable?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  }>;
}

export interface ParentChildData {
  student: { id: string; fullName: string };
  relationshipCode: string;
  attendance?: Array<{ date: string; status?: { label: string; code?: string } | null }>;
  assessments: Array<{
    assessment: string | null;
    grade: string | null;
    percentage: number | null;
  }>;
  fees: {
    outstanding: number;
    recent: Array<{
      feeType?: { name: string };
      netAmount: number;
      status?: { label: string; code?: string };
    }>;
  };
  timetable?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  }>;
}

export interface ParentPortalData {
  parent: { id?: string; fullName: string; email?: string } | null;
  message?: string;
  notices?: Array<{ title: string; body: string; publishedAt: string | null }>;
  children: Array<ParentChildData>;
}

export interface ParentAiSummary {
  children: Array<{
    student: { fullName: string };
    narrative: string;
    overallPercentage: number | null;
    recommendations: Array<{ subject: string; tip: string }>;
  }>;
}

export function attendanceStatusCounts(
  records: Array<{ status?: { label: string } | null }> | undefined,
) {
  const counts = { present: 0, absent: 0, late: 0, other: 0 };
  for (const record of records ?? []) {
    const label = record.status?.label?.toLowerCase() ?? '';
    if (label.includes('present')) counts.present += 1;
    else if (label.includes('absent')) counts.absent += 1;
    else if (label.includes('late')) counts.late += 1;
    else counts.other += 1;
  }
  return counts;
}

export function attendanceRatePercents(
  records: Array<{ status?: { label: string } | null }> | undefined,
) {
  const counts = attendanceStatusCounts(records);
  const total = Math.max(counts.present + counts.absent + counts.late + counts.other, 1);
  return {
    present: Math.round((counts.present / total) * 100),
    absent: Math.round((counts.absent / total) * 100),
    late: Math.round((counts.late / total) * 100),
  };
}
