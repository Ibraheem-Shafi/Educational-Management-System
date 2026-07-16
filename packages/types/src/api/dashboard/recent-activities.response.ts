export type DashboardActivityKind =
  | 'student'
  | 'teacher'
  | 'fee'
  | 'attendance'
  | 'branch'
  | 'report';

export interface DashboardRecentActivity {
  id: string;
  title: string;
  description: string;
  kind: DashboardActivityKind;
  occurredAt: string;
}

export interface DashboardRecentActivitiesResponse {
  activities: DashboardRecentActivity[];
}
