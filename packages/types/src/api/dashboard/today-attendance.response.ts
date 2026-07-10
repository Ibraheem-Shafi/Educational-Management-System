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
  teachersAndStaff: DashboardAttendanceRing;
  overall: DashboardAttendanceRing;
}
