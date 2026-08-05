/** Centralized React Query keys for cache consistency across pages.
 *
 * Pattern: omit optional `params` (and similar) segments when absent so
 * `invalidateQueries({ queryKey: queryKeys.foo(branchId) })` prefix-matches
 * paginated list keys. Never append a trailing `undefined` — TanStack Query v5
 * will not match that against a params object.
 */

type Params = Record<string, unknown>;

function branchListKey(prefix: string, branchId?: string, params?: Params) {
  return params
    ? ([prefix, branchId, params] as const)
    : ([prefix, branchId] as const);
}

function listKey(prefix: string, params?: Params) {
  return params ? ([prefix, params] as const) : ([prefix] as const);
}

export const queryKeys = {
  institutionSettings: ['institution-settings'] as const,
  branches: ['branches'] as const,
  branchesStats: ['branches-stats'] as const,
  branchDetail: (id: string) => ['branch', id] as const,
  batches: (branchId: string, programId?: string, params?: Params) =>
    params
      ? programId
        ? (['batches', branchId, programId, params] as const)
        : (['batches', branchId, params] as const)
      : programId
        ? (['batches', branchId, programId] as const)
        : (['batches', branchId] as const),
  lookups: (type: string) => ['lookups', type] as const,
  students: (params?: Params) => listKey('students', params),
  studentsOptions: (branchId: string, params?: Params) =>
    params
      ? (['students-options', branchId, params] as const)
      : (['students-options', branchId] as const),
  usersOptions: (branchId: string, params?: Params) =>
    params
      ? (['users-options', branchId, params] as const)
      : (['users-options', branchId] as const),
  subjectsOptions: (params?: Params) => listKey('subjects-options', params),
  studentsRecent: ['students-recent'] as const,
  studentsStats: ['students-stats'] as const,
  usersStats: ['users-stats'] as const,
  userDetail: (id: string) => ['user', id] as const,
  reportsOverview: ['reports-overview'] as const,
  dashboardStats: ['dashboard-stats'] as const,
  dashboardTodayAttendance: ['dashboard-today-attendance'] as const,
  dashboardMonthlyRevenue: ['dashboard-monthly-revenue'] as const,
  dashboardBranchPerformance: ['dashboard-branch-performance'] as const,
  dashboardRecentActivities: ['dashboard-recent-activities'] as const,
  analyticsDashboard: ['analytics-dashboard'] as const,
  attendanceStats: ['attendance-stats'] as const,
  attendanceTrend: (month: string) => ['attendance-trend', month] as const,
  feesStats: ['fees-stats'] as const,
  feesRevenueTrend: ['fees-revenue-trend'] as const,
  parentsStats: ['parents-stats'] as const,
  noticesStats: ['notices-stats'] as const,
  learningStats: ['learning-stats'] as const,
  learning: (params?: Params) => listKey('learning', params),
  documentsStats: ['documents-stats'] as const,
  communicationsStats: ['communications-stats'] as const,
  assessmentsStats: ['assessments-stats'] as const,
  assessments: (params?: Params) => listKey('assessments', params),
  assessmentTypes: (params?: Params) => listKey('assessment-types', params),
  assessmentSeries: (params?: Params) => listKey('assessment-series', params),
  academicStats: (tab?: string) => (tab ? (['academic-stats', tab] as const) : (['academic-stats'] as const)),
  academicSessions: (params?: Params) => listKey('academic-sessions', params),
  programs: (branchId?: string, params?: Params) =>
    params
      ? branchId
        ? (['programs', branchId, params] as const)
        : (['programs', params] as const)
      : branchId
        ? (['programs', branchId] as const)
        : (['programs'] as const),
  programDetail: (id: string) => ['program', id] as const,
  subjects: ['subjects'] as const,
  batchSubjects: (batchId: string) => ['batch-subjects', batchId] as const,
  timetableStats: ['timetable-stats'] as const,
  auditStats: ['audit-stats'] as const,
  formFields: (params?: Params) => listKey('form-fields', params),
  aiInsightsAtRisk: (params?: Params) => listKey('ai-insights-at-risk', params),
  aiAttendanceSessions: (params?: Params) => listKey('ai-attendance-sessions', params),
  reportsFeeDefaulters: (params?: Params) => listKey('reports-fee-defaulters', params),
  portalStudentStats: ['portal-student-stats'] as const,
  portalParentStats: ['portal-parent-stats'] as const,
  portalStudentLearning: (params?: Params) => listKey('portal-student-learning', params),
  portalStudentLearningDueSoon: ['portal-student-learning-due-soon'] as const,
  portalStudentLearningDetail: (id: string) => ['portal-student-learning', id] as const,
  portalParentLearning: (params?: Params) => listKey('portal-parent-learning', params),
  portalParentLearningDueSoon: (studentId: string) =>
    ['portal-parent-learning-due-soon', studentId] as const,
  portalParentLearningDetail: (id: string, studentId: string) =>
    ['portal-parent-learning', id, studentId] as const,
  portalStudentAttendance: (params?: Params) => listKey('portal-student-attendance', params),
  portalStudentAssessments: (params?: Params) => listKey('portal-student-assessments', params),
  portalStudentFees: (params?: Params) => listKey('portal-student-fees', params),
  portalStudentTimetable: ['portal-student-timetable'] as const,
  portalStudentNotices: (params?: Params) => listKey('portal-student-notices', params),
  portalStudentDocuments: (params?: Params) => listKey('portal-student-documents', params),
  portalStudentCalendar: (month: string) => ['portal-student-calendar', month] as const,
  portalStudentInsights: ['portal-student-insights'] as const,
  portalStudentProfile: ['portal-student-profile'] as const,
  portalParentAttendance: (params?: Params) => listKey('portal-parent-attendance', params),
  portalParentAssessments: (params?: Params) => listKey('portal-parent-assessments', params),
  portalParentFees: (params?: Params) => listKey('portal-parent-fees', params),
  portalParentTimetable: (studentId: string) => ['portal-parent-timetable', studentId] as const,
  portalParentNotices: (params?: Params) => listKey('portal-parent-notices', params),
  portalParentDocuments: (params?: Params) => listKey('portal-parent-documents', params),
  portalParentCalendar: (studentId: string, month: string) =>
    ['portal-parent-calendar', studentId, month] as const,
  portalParentProfile: ['portal-parent-profile'] as const,
  portalParentLeave: (studentId?: string, page?: number, limit?: number) => {
    const id = studentId ?? 'all';
    if (page !== undefined && limit !== undefined) {
      return ['portal-parent-leave', id, page, limit] as const;
    }
    if (page !== undefined) {
      return ['portal-parent-leave', id, page] as const;
    }
    return ['portal-parent-leave', id] as const;
  },
  leaveRequests: ['leave-requests'] as const,
  frontOfficeInquiries: (branchId?: string, params?: Params) =>
    branchListKey('front-office-inquiries', branchId, params),
  frontOfficeVisitors: (branchId?: string, params?: Params) =>
    branchListKey('front-office-visitors', branchId, params),
  frontOfficeComplaints: (branchId?: string, params?: Params) =>
    branchListKey('front-office-complaints', branchId, params),
  frontOfficeActivities: (branchId?: string) => ['front-office-activities', branchId] as const,
  certificateIssues: (branchId?: string, params?: Params) =>
    branchListKey('certificate-issues', branchId, params),
  certificateTemplates: (branchId?: string) =>
    branchId ? (['certificate-templates', branchId] as const) : (['certificate-templates'] as const),
  libraryStats: (branchId?: string) => ['library-stats', branchId] as const,
  libraryCategories: (branchId?: string, params?: Params) =>
    branchListKey('library-categories', branchId, params),
  libraryBooks: (branchId?: string, params?: Params) =>
    branchListKey('library-books', branchId, params),
  libraryLoans: (branchId?: string, params?: Params) =>
    branchListKey('library-loans', branchId, params),
  libraryReservations: (branchId?: string, params?: Params) =>
    branchListKey('library-reservations', branchId, params),
  libraryFines: (branchId?: string, params?: Params) =>
    branchListKey('library-fines', branchId, params),
  transportVehicles: (branchId?: string, params?: Params) =>
    branchListKey('transport-vehicles', branchId, params),
  transportRoutes: (branchId?: string, params?: Params) =>
    branchListKey('transport-routes', branchId, params),
  transportStudentAssignments: (branchId?: string, params?: Params) =>
    branchListKey('transport-student-assignments', branchId, params),
  transportTrips: (branchId?: string, params?: Params) =>
    branchListKey('transport-trips', branchId, params),
  transportTrip: (tripId: string) => ['transport-trip', tripId] as const,
  biometricDevices: (branchId?: string, params?: Params) =>
    branchListKey('biometric-devices', branchId, params),
  biometricMappings: (branchId?: string, params?: Params) =>
    branchListKey('biometric-mappings', branchId, params),
  biometricPunchLogs: (branchId?: string, params?: Params) =>
    branchListKey('biometric-punch-logs', branchId, params),
  payrollStructures: (branchId?: string, params?: Params) =>
    branchListKey('payroll-structures', branchId, params),
  payrollRuns: (branchId?: string, params?: Params) =>
    branchListKey('payroll-runs', branchId, params),
  payrollRun: (runId: string) => ['payroll-run', runId] as const,
  payrollHistory: (branchId?: string, params?: Params) =>
    branchListKey('payroll-history', branchId, params),
  payrollLinePrint: (lineId: string) => ['payroll-line-print', lineId] as const,
  accountingAccounts: (branchId?: string, params?: Params) =>
    branchListKey('accounting-accounts', branchId, params),
  accountingVouchers: (branchId?: string, params?: Params) =>
    branchListKey('accounting-vouchers', branchId, params),
  accountingBudgets: (branchId?: string, params?: Params) =>
    branchListKey('accounting-budgets', branchId, params),
};

/** Root prefixes for invalidate/refetch — always match every filtered/paginated variant. */
export const queryRoots = {
  accountingAccounts: ['accounting-accounts'] as const,
  accountingVouchers: ['accounting-vouchers'] as const,
  accountingBudgets: ['accounting-budgets'] as const,
};
