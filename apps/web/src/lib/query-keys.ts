/** Centralized React Query keys for cache consistency across pages. */

export const queryKeys = {
  institutionSettings: ['institution-settings'] as const,
  branches: ['branches'] as const,
  branchesStats: ['branches-stats'] as const,
  branchDetail: (id: string) => ['branch', id] as const,
  batches: (branchId: string, programId?: string, params?: Record<string, unknown>) =>
    params
      ? programId
        ? (['batches', branchId, programId, params] as const)
        : (['batches', branchId, params] as const)
      : programId
        ? (['batches', branchId, programId] as const)
        : (['batches', branchId] as const),
  lookups: (type: string) => ['lookups', type] as const,
  students: (params?: Record<string, unknown>) =>
    params ? (['students', params] as const) : (['students'] as const),
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
  learning: (params?: Record<string, unknown>) =>
    params ? (['learning', params] as const) : (['learning'] as const),
  documentsStats: ['documents-stats'] as const,
  communicationsStats: ['communications-stats'] as const,
  assessmentsStats: ['assessments-stats'] as const,
  assessments: (params?: Record<string, unknown>) =>
    params ? (['assessments', params] as const) : (['assessments'] as const),
  assessmentTypes: (params?: Record<string, unknown>) =>
    params ? (['assessment-types', params] as const) : (['assessment-types'] as const),
  assessmentSeries: (params?: Record<string, unknown>) =>
    params ? (['assessment-series', params] as const) : (['assessment-series'] as const),
  academicStats: (tab?: string) => (tab ? (['academic-stats', tab] as const) : (['academic-stats'] as const)),
  academicSessions: (params?: Record<string, unknown>) =>
    params ? (['academic-sessions', params] as const) : (['academic-sessions'] as const),
  programs: (branchId?: string, params?: Record<string, unknown>) =>
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
  formFields: (params?: Record<string, unknown>) =>
    params ? (['form-fields', params] as const) : (['form-fields'] as const),
  aiInsightsAtRisk: (params?: Record<string, unknown>) =>
    params ? (['ai-insights-at-risk', params] as const) : (['ai-insights-at-risk'] as const),
  aiAttendanceSessions: (params?: Record<string, unknown>) =>
    params ? (['ai-attendance-sessions', params] as const) : (['ai-attendance-sessions'] as const),
  reportsFeeDefaulters: (params?: Record<string, unknown>) =>
    params ? (['reports-fee-defaulters', params] as const) : (['reports-fee-defaulters'] as const),
  portalStudentStats: ['portal-student-stats'] as const,
  portalParentStats: ['portal-parent-stats'] as const,
  portalStudentLearning: (params?: Record<string, unknown>) =>
    params ? (['portal-student-learning', params] as const) : (['portal-student-learning'] as const),
  portalStudentLearningDueSoon: ['portal-student-learning-due-soon'] as const,
  portalStudentLearningDetail: (id: string) => ['portal-student-learning', id] as const,
  portalParentLearning: (params?: Record<string, unknown>) =>
    params ? (['portal-parent-learning', params] as const) : (['portal-parent-learning'] as const),
  portalParentLearningDueSoon: (studentId: string) =>
    ['portal-parent-learning-due-soon', studentId] as const,
  portalParentLearningDetail: (id: string, studentId: string) =>
    ['portal-parent-learning', id, studentId] as const,
  portalStudentAttendance: (params?: Record<string, unknown>) =>
    ['portal-student-attendance', params] as const,
  portalStudentAssessments: (params?: Record<string, unknown>) =>
    ['portal-student-assessments', params] as const,
  portalStudentFees: (params?: Record<string, unknown>) =>
    ['portal-student-fees', params] as const,
  portalStudentTimetable: ['portal-student-timetable'] as const,
  portalStudentNotices: (params?: Record<string, unknown>) =>
    ['portal-student-notices', params] as const,
  portalStudentDocuments: (params?: Record<string, unknown>) =>
    ['portal-student-documents', params] as const,
  portalStudentCalendar: (month: string) => ['portal-student-calendar', month] as const,
  portalStudentInsights: ['portal-student-insights'] as const,
  portalStudentProfile: ['portal-student-profile'] as const,
  portalParentAttendance: (params?: Record<string, unknown>) =>
    ['portal-parent-attendance', params] as const,
  portalParentAssessments: (params?: Record<string, unknown>) =>
    ['portal-parent-assessments', params] as const,
  portalParentFees: (params?: Record<string, unknown>) =>
    ['portal-parent-fees', params] as const,
  portalParentTimetable: (studentId: string) => ['portal-parent-timetable', studentId] as const,
  portalParentNotices: (params?: Record<string, unknown>) =>
    ['portal-parent-notices', params] as const,
  portalParentDocuments: (params?: Record<string, unknown>) =>
    ['portal-parent-documents', params] as const,
  portalParentCalendar: (studentId: string, month: string) =>
    ['portal-parent-calendar', studentId, month] as const,
  portalParentProfile: ['portal-parent-profile'] as const,
  portalParentLeave: (studentId?: string, page?: number, limit?: number) =>
    ['portal-parent-leave', studentId ?? 'all', page ?? 1, limit ?? 8] as const,
  leaveRequests: ['leave-requests'] as const,
  frontOfficeInquiries: (branchId?: string, params?: Record<string, unknown>) =>
    ['front-office-inquiries', branchId, params] as const,
  frontOfficeVisitors: (branchId?: string, params?: Record<string, unknown>) =>
    ['front-office-visitors', branchId, params] as const,
  frontOfficeComplaints: (branchId?: string, params?: Record<string, unknown>) =>
    ['front-office-complaints', branchId, params] as const,
  frontOfficeActivities: (branchId?: string) => ['front-office-activities', branchId] as const,
  certificateIssues: (branchId?: string, params?: Record<string, unknown>) =>
    ['certificate-issues', branchId, params] as const,
  certificateTemplates: (branchId?: string) =>
    branchId ? (['certificate-templates', branchId] as const) : (['certificate-templates'] as const),
  libraryStats: (branchId?: string) => ['library-stats', branchId] as const,
  libraryCategories: (branchId?: string, params?: Record<string, unknown>) =>
    ['library-categories', branchId, params] as const,
  libraryBooks: (branchId?: string, params?: Record<string, unknown>) =>
    ['library-books', branchId, params] as const,
  libraryLoans: (branchId?: string, params?: Record<string, unknown>) =>
    ['library-loans', branchId, params] as const,
  libraryReservations: (branchId?: string, params?: Record<string, unknown>) =>
    ['library-reservations', branchId, params] as const,
  libraryFines: (branchId?: string, params?: Record<string, unknown>) =>
    ['library-fines', branchId, params] as const,
  transportVehicles: (branchId?: string, params?: Record<string, unknown>) =>
    ['transport-vehicles', branchId, params] as const,
  transportRoutes: (branchId?: string, params?: Record<string, unknown>) =>
    ['transport-routes', branchId, params] as const,
  transportStudentAssignments: (branchId?: string, params?: Record<string, unknown>) =>
    ['transport-student-assignments', branchId, params] as const,
  transportTrips: (branchId?: string, params?: Record<string, unknown>) =>
    ['transport-trips', branchId, params] as const,
  transportTrip: (tripId: string) => ['transport-trip', tripId] as const,
  biometricDevices: (branchId?: string, params?: Record<string, unknown>) =>
    ['biometric-devices', branchId, params] as const,
  biometricMappings: (branchId?: string, params?: Record<string, unknown>) =>
    ['biometric-mappings', branchId, params] as const,
  biometricPunchLogs: (branchId?: string, params?: Record<string, unknown>) =>
    ['biometric-punch-logs', branchId, params] as const,
  payrollStructures: (branchId?: string, params?: Record<string, unknown>) =>
    ['payroll-structures', branchId, params] as const,
  payrollRuns: (branchId?: string, params?: Record<string, unknown>) =>
    ['payroll-runs', branchId, params] as const,
  payrollRun: (runId: string) => ['payroll-run', runId] as const,
  payrollHistory: (branchId?: string, params?: Record<string, unknown>) =>
    ['payroll-history', branchId, params] as const,
  payrollLinePrint: (lineId: string) => ['payroll-line-print', lineId] as const,
  accountingAccounts: (branchId?: string, params?: Record<string, unknown>) =>
    ['accounting-accounts', branchId, params] as const,
  accountingVouchers: (branchId?: string, params?: Record<string, unknown>) =>
    ['accounting-vouchers', branchId, params] as const,
  accountingBudgets: (branchId?: string, params?: Record<string, unknown>) =>
    ['accounting-budgets', branchId, params] as const,
};
