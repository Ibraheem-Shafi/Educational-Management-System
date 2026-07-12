export interface DashboardAttendanceRing {
  rate: number;
  presentCount: number;
  totalCount: number;
}

export interface DashboardTodayAttendanceResponse {
  date: string;
  dateLabel: string;
  scopeLabel: string;
  students: DashboardAttendanceRing;
  /** Omitted when caller lacks `users.manage` (student-only view). */
  teachersAndStaff?: DashboardAttendanceRing;
  /** Omitted when caller lacks `users.manage` (student-only view). */
  overall?: DashboardAttendanceRing;
}
