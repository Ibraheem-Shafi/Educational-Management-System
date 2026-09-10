import { PERMISSIONS } from '@eims/shared';

export type ReportGroup = 'administration' | 'academic' | 'finance';
export type ReportStatus = 'ready' | 'coming_soon';

export type ReportGenerateKey =
  | 'enrollment'
  | 'student-attendance'
  | 'teacher-attendance'
  | 'staff-attendance'
  | 'assessments'
  | 'performance'
  | 'at-risk'
  | 'top-performers'
  | 'homework'
  | 'admissions-withdrawals'
  | 'fee-collection'
  | 'fee-defaulters'
  | 'monthly-income'
  | 'monthly-expense'
  | 'budget-vs-actual'
  | 'payroll'
  | 'accounts-receivable'
  | 'scholarship-discount'
  | 'audit'
  | 'leave'
  | 'transport'
  | 'complaints'
  | 'syllabus'
  | 'lesson-plans'
  | 'observation'
  | 'training'
  | 'curriculum'
  | 'cocurricular'
  | 'discipline'
  | 'ptm'
  | 'improvement'
  | 'challenges'
  | 'petty-cash'
  | 'bank-rec'
  | 'accounts-payable'
  | 'procurement'
  | 'inventory'
  | 'maintenance'
  | 'utilities'
  | 'cash-flow'
  | 'forecast'
  | 'profitability'
  | 'risk'
  | 'recruitment'
  | 'turnover'
  | 'infrastructure'
  | 'safety'
  | 'it-erp'
  | 'compliance';

export type ReportCatalogItem = {
  id: string;
  number: number;
  title: string;
  group: ReportGroup;
  status: ReportStatus;
  /** Permissions that unlock Generate / Open. The row stays visible without them. */
  sourcePermissions: string[];
  href?: string;
  generateKey?: ReportGenerateKey;
};

export const REPORT_GROUP_META: Record<
  ReportGroup,
  { title: string; href: string; description: string }
> = {
  academic: {
    title: 'Academic reports',
    href: '/dashboard/reports/academic',
    description: 'Enrollment, attendance, assessments, and performance exports',
  },
  finance: {
    title: 'Finance reports',
    href: '/dashboard/reports/finance',
    description: 'Fees, accounting, payroll, and receivable exports',
  },
  administration: {
    title: 'Admin reports',
    href: '/dashboard/reports/administration',
    description: 'Staff operations, leave, transport, and complaints',
  },
};

const ACADEMIC: ReportCatalogItem[] = [
  {
    id: 'acad-enrollment',
    number: 1,
    title: 'Student Enrollment Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.STUDENTS_READ],
    href: '/dashboard/students',
    generateKey: 'enrollment',
  },
  {
    id: 'acad-student-attendance',
    number: 2,
    title: 'Student Attendance Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ATTENDANCE_READ],
    href: '/dashboard/attendance',
    generateKey: 'student-attendance',
  },
  {
    id: 'acad-teacher-attendance',
    number: 3,
    title: 'Teacher Attendance Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ATTENDANCE_READ],
    href: '/dashboard/attendance',
    generateKey: 'teacher-attendance',
  },
  {
    id: 'acad-syllabus',
    number: 4,
    title: 'Syllabus Coverage Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'syllabus',
  },
  {
    id: 'acad-assessments',
    number: 5,
    title: 'Examination & Assessment Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ASSESSMENTS_READ],
    href: '/dashboard/assessments',
    generateKey: 'assessments',
  },
  {
    id: 'acad-performance',
    number: 6,
    title: 'Student Performance Analysis Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ANALYTICS_READ],
    href: '/dashboard/analytics',
    generateKey: 'performance',
  },
  {
    id: 'acad-at-risk',
    number: 7,
    title: 'Low Performers / At-Risk Students Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ANALYTICS_READ],
    href: '/dashboard/analytics',
    generateKey: 'at-risk',
  },
  {
    id: 'acad-top-performers',
    number: 8,
    title: 'Top Performers Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ANALYTICS_READ],
    href: '/dashboard/analytics',
    generateKey: 'top-performers',
  },
  {
    id: 'acad-lesson-plans',
    number: 9,
    title: 'Lesson Plan Compliance Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'lesson-plans',
  },
  {
    id: 'acad-observation',
    number: 10,
    title: 'Classroom Observation Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'observation',
  },
  {
    id: 'acad-homework',
    number: 11,
    title: 'Homework & Assignment Monitoring Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.LEARNING_READ],
    href: '/dashboard/learning',
    generateKey: 'homework',
  },
  {
    id: 'acad-teacher-eval',
    number: 12,
    title: 'Teacher Performance Evaluation Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.HR_READ],
    href: '/dashboard/users',
  },
  {
    id: 'acad-training',
    number: 13,
    title: 'Teacher Training & PD Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.HR_READ, PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/hr',
    generateKey: 'training',
  },
  {
    id: 'acad-curriculum',
    number: 14,
    title: 'Curriculum Implementation Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'curriculum',
  },
  {
    id: 'acad-cocurricular',
    number: 15,
    title: 'Co-curricular Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'cocurricular',
  },
  {
    id: 'acad-discipline',
    number: 16,
    title: 'Discipline & Behaviour Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'discipline',
  },
  {
    id: 'acad-ptm',
    number: 17,
    title: 'PTM Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'ptm',
  },
  {
    id: 'acad-admissions-withdrawals',
    number: 18,
    title: 'Admissions & Withdrawals Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.STUDENTS_READ],
    href: '/dashboard/students',
    generateKey: 'admissions-withdrawals',
  },
  {
    id: 'acad-improvement',
    number: 19,
    title: 'Academic Improvement Plan Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'improvement',
  },
  {
    id: 'acad-challenges',
    number: 20,
    title: 'Academic Challenges & Action Taken Report',
    group: 'academic',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACADEMIC_READ],
    href: '/dashboard/academic-ops',
    generateKey: 'challenges',
  },
];

const FINANCE: ReportCatalogItem[] = [
  {
    id: 'fin-fee-collection',
    number: 1,
    title: 'Fee Collection Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.FEES_READ],
    href: '/dashboard/fees',
    generateKey: 'fee-collection',
  },
  {
    id: 'fin-fee-defaulters',
    number: 2,
    title: 'Fee Defaulters Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.REPORTS_VIEW],
    generateKey: 'fee-defaulters',
  },
  {
    id: 'fin-monthly-income',
    number: 3,
    title: 'Monthly Income Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/accounting',
    generateKey: 'monthly-income',
  },
  {
    id: 'fin-monthly-expense',
    number: 4,
    title: 'Monthly Expense Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/accounting',
    generateKey: 'monthly-expense',
  },
  {
    id: 'fin-budget-vs-actual',
    number: 5,
    title: 'Budget vs Actual Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/accounting',
    generateKey: 'budget-vs-actual',
  },
  {
    id: 'fin-payroll',
    number: 6,
    title: 'Payroll & Salary Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.PAYROLL_READ],
    href: '/dashboard/payroll',
    generateKey: 'payroll',
  },
  {
    id: 'fin-petty-cash',
    number: 7,
    title: 'Petty Cash Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'petty-cash',
  },
  {
    id: 'fin-bank-rec',
    number: 8,
    title: 'Bank Reconciliation Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'bank-rec',
  },
  {
    id: 'fin-ar',
    number: 9,
    title: 'Accounts Receivable Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.FEES_READ],
    href: '/dashboard/fees',
    generateKey: 'accounts-receivable',
  },
  {
    id: 'fin-ap',
    number: 10,
    title: 'Accounts Payable Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'accounts-payable',
  },
  {
    id: 'fin-procurement',
    number: 11,
    title: 'Procurement Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'procurement',
  },
  {
    id: 'fin-inventory',
    number: 12,
    title: 'Inventory & Fixed Assets Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'inventory',
  },
  {
    id: 'fin-maintenance',
    number: 13,
    title: 'Maintenance & Repair Expense Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'maintenance',
  },
  {
    id: 'fin-utilities',
    number: 14,
    title: 'Utility Bills Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'utilities',
  },
  {
    id: 'fin-cash-flow',
    number: 15,
    title: 'Cash Flow Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'cash-flow',
  },
  {
    id: 'fin-forecast',
    number: 16,
    title: 'Financial Forecast Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'forecast',
  },
  {
    id: 'fin-discounts',
    number: 17,
    title: 'Scholarship & Discount Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.FEES_READ],
    href: '/dashboard/fees',
    generateKey: 'scholarship-discount',
  },
  {
    id: 'fin-audit',
    number: 18,
    title: 'Audit & Compliance Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.AUDIT_READ],
    href: '/dashboard/audit',
    generateKey: 'audit',
  },
  {
    id: 'fin-profitability',
    number: 19,
    title: 'Campus Profitability Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'profitability',
  },
  {
    id: 'fin-risk',
    number: 20,
    title: 'Financial Risk Report',
    group: 'finance',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ACCOUNTING_READ],
    href: '/dashboard/finance-ops',
    generateKey: 'risk',
  },
];

const ADMINISTRATION: ReportCatalogItem[] = [
  {
    id: 'adm-staff-attendance',
    number: 1,
    title: 'Staff Attendance Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.ATTENDANCE_READ],
    href: '/dashboard/attendance',
    generateKey: 'staff-attendance',
  },
  {
    id: 'adm-recruitment',
    number: 2,
    title: 'Staff Recruitment Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.HR_READ],
    href: '/dashboard/hr',
    generateKey: 'recruitment',
  },
  {
    id: 'adm-turnover',
    number: 3,
    title: 'Staff Turnover Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.HR_READ],
    href: '/dashboard/hr',
    generateKey: 'turnover',
  },
  {
    id: 'adm-leave',
    number: 4,
    title: 'Leave Management Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.LEAVE_READ],
    href: '/dashboard/leave-requests',
    generateKey: 'leave',
  },
  {
    id: 'adm-infrastructure',
    number: 5,
    title: 'Infrastructure & Maintenance Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.SETTINGS_MANAGE],
    href: '/dashboard/campus-ops',
    generateKey: 'infrastructure',
  },
  {
    id: 'adm-safety',
    number: 6,
    title: 'Safety & Security Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.SETTINGS_MANAGE],
    href: '/dashboard/campus-ops',
    generateKey: 'safety',
  },
  {
    id: 'adm-transport',
    number: 7,
    title: 'Transport Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.TRANSPORT_READ],
    href: '/dashboard/transport',
    generateKey: 'transport',
  },
  {
    id: 'adm-it-erp',
    number: 8,
    title: 'IT & ERP Status Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.SETTINGS_MANAGE],
    href: '/dashboard/campus-ops',
    generateKey: 'it-erp',
  },
  {
    id: 'adm-complaints',
    number: 9,
    title: 'Complaint Resolution Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.FRONT_OFFICE_READ],
    href: '/dashboard/front-office',
    generateKey: 'complaints',
  },
  {
    id: 'adm-compliance',
    number: 10,
    title: 'Compliance Report',
    group: 'administration',
    status: 'ready',
    sourcePermissions: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.AUDIT_READ],
    href: '/dashboard/campus-ops',
    generateKey: 'compliance',
  },
];

export const REPORT_CATALOG: ReportCatalogItem[] = [...ADMINISTRATION, ...ACADEMIC, ...FINANCE];

export function reportsForGroup(group: ReportGroup): ReportCatalogItem[] {
  return REPORT_CATALOG.filter((item) => item.group === group).sort((a, b) => a.number - b.number);
}

export function catalogCounts(group: ReportGroup): { total: number; ready: number; comingSoon: number } {
  const items = reportsForGroup(group);
  const ready = items.filter((item) => item.status === 'ready').length;
  return { total: items.length, ready, comingSoon: items.length - ready };
}
