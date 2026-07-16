export interface ReportsOverviewResponse {
  branchId: string | null;
  students: {
    total: number;
    changePercent: number | null;
  };
  fees: {
    pendingCount: number;
    paidCount: number;
    pendingAmount: number;
    /** All-time collected fee amount. */
    collectedAmount: number;
    /** Fees collected in the last 30 days (dashboard stat value). */
    collectedLast30Days: number;
    changePercent: number | null;
  };
  attendanceMarkedToday: {
    count: number;
    changePercent: number | null;
  };
  parents: {
    total: number;
    changePercent: number | null;
  };
  staffUsers: number;
}
