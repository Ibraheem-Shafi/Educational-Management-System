export interface UsersStatsResponse {
  totalUsers: {
    total: number;
    changePercent: number | null;
  };
  activeUsers: {
    total: number;
    changePercent: number | null;
  };
  inactiveUsers: {
    total: number;
    changePercent: number | null;
  };
  pendingInvitations: {
    total: number;
    changePercent: number | null;
  };
}
