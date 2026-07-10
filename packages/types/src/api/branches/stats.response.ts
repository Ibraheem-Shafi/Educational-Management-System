export interface BranchesStatsResponse {
  totalBranches: {
    total: number;
    changePercent: number | null;
  };
  activeBranches: {
    total: number;
    changePercent: number | null;
  };
  inactiveBranches: {
    total: number;
    changePercent: number | null;
  };
  totalStudents: {
    total: number;
    changePercent: number | null;
  };
}
