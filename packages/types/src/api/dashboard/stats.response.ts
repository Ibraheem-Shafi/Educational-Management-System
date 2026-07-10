export interface DashboardStatsResponse {
  totalBranches: {
    total: number;
    changePercent: number | null;
  };
  totalStudents: {
    total: number;
    changePercent: number | null;
  };
  teachersAndStaff: {
    total: number;
    changePercent: number | null;
  };
  totalClasses: {
    total: number;
    changePercent: number | null;
  };
}
