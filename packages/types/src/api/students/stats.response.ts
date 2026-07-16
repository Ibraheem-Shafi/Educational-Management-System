export interface StudentsStatsResponse {
  totalStudents: {
    total: number;
    changePercent: number | null;
  };
  activeStudents: {
    total: number;
    changePercent: number | null;
  };
  inactiveStudents: {
    total: number;
    changePercent: number | null;
  };
  totalBatches: {
    total: number;
    changePercent: number | null;
  };
}
