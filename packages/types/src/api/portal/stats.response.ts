import type { CountWithTrend } from '../common/stats-metric';

export interface PortalStudentStatsResponse {
  attendanceRate: CountWithTrend;
  outstandingFees: CountWithTrend;
  averageGrade: CountWithTrend;
  upcomingClasses: CountWithTrend;
}

export interface PortalParentStatsResponse {
  childrenCount: CountWithTrend;
  aggregateAttendance: CountWithTrend;
  totalOutstanding: CountWithTrend;
  recentNotices: CountWithTrend;
}
