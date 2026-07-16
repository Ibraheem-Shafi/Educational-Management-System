export interface DashboardBranchPerformanceRow {
  id: string;
  name: string;
  addressLabel: string;
  email: string | null;
  phone: string | null;
  principalName: string | null;
  studentCount: number;
  attendanceRate: number;
  isActive: boolean;
}

export interface DashboardBranchPerformanceResponse {
  branches: DashboardBranchPerformanceRow[];
}
