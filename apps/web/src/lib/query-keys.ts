/** Centralized React Query keys for cache consistency across pages. */

export const queryKeys = {
  institutionSettings: ['institution-settings'] as const,
  branches: ['branches'] as const,
  branchesStats: ['branches-stats'] as const,
  branchDetail: (id: string) => ['branch', id] as const,
  batches: (branchId: string, programId?: string) =>
    programId ? (['batches', branchId, programId] as const) : (['batches', branchId] as const),
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
  academicStats: (tab?: string) => (tab ? (['academic-stats', tab] as const) : (['academic-stats'] as const)),
  timetableStats: ['timetable-stats'] as const,
  auditStats: ['audit-stats'] as const,
  formFields: ['form-fields'] as const,
  aiInsightsAtRisk: ['ai-insights-at-risk'] as const,
  aiAttendanceSessions: ['ai-attendance-sessions'] as const,
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
  portalParentLeave: (studentId?: string) => ['portal-parent-leave', studentId ?? 'all'] as const,
  leaveRequests: ['leave-requests'] as const,
};
