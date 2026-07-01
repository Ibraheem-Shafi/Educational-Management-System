/** Centralized React Query keys for cache consistency across pages. */

export const queryKeys = {
  institutionSettings: ['institution-settings'] as const,
  branches: ['branches'] as const,
  batches: (branchId: string, programId?: string) =>
    programId ? (['batches', branchId, programId] as const) : (['batches', branchId] as const),
  lookups: (type: string) => ['lookups', type] as const,
  students: (params?: Record<string, unknown>) =>
    params ? (['students', params] as const) : (['students'] as const),
  studentsRecent: ['students-recent'] as const,
  reportsOverview: ['reports-overview'] as const,
  analyticsDashboard: ['analytics-dashboard'] as const,
};
