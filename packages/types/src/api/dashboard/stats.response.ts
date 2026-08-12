export interface DashboardStatMetric {
  total: number;
  changePercent: number | null;
}

export interface DashboardStatsResponse {
  /**
   * Present when caller has `branches.manage` (institution-wide, ignores branch selector)
   * or `branches.read` (scoped to the caller's accessible branch/es).
   */
  totalBranches?: DashboardStatMetric;
  /** Present when caller has `students.read`. */
  totalStudents?: DashboardStatMetric;
  /** Present when caller has `users.manage`. */
  teachersAndStaff?: DashboardStatMetric;
  /** Present when caller has `academic.read`, or teacher-scoped classes when only students.read. */
  totalClasses?: DashboardStatMetric;
}
