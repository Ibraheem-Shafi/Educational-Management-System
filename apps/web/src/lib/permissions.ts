import type { AuthUser } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | (string & {});

export function hasPermission(
  user: Pick<AuthUser, 'permissions'> | null | undefined,
  permission: Permission | Permission[],
): boolean {
  if (!user?.permissions?.length) return false;
  const required = Array.isArray(permission) ? permission : [permission];
  if (required.length === 0) return true;
  return required.every((p) => user.permissions.includes(p));
}

export function hasAnyPermission(
  user: Pick<AuthUser, 'permissions'> | null | undefined,
  permissions: Permission[],
): boolean {
  if (!user?.permissions?.length || permissions.length === 0) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

/**
 * Longest-prefix match for dashboard route access.
 * `null` = staff-only (no module permission).
 * More specific paths must appear before shorter prefixes of the same tree
 * (matching sorts by path length descending at lookup time).
 */
export const ROUTE_PERMISSIONS: Array<{ path: string; permission: Permission | null }> = [
  { path: '/dashboard/profile', permission: null },
  { path: '/dashboard/students/new', permission: PERMISSIONS.STUDENTS_CREATE },
  { path: '/dashboard/students', permission: PERMISSIONS.STUDENTS_READ },
  { path: '/dashboard/front-office', permission: PERMISSIONS.FRONT_OFFICE_READ },
  { path: '/dashboard/library', permission: PERMISSIONS.LIBRARY_READ },
  { path: '/dashboard/attendance', permission: PERMISSIONS.ATTENDANCE_READ },
  { path: '/dashboard/assessments', permission: PERMISSIONS.ASSESSMENTS_READ },
  { path: '/dashboard/fees', permission: PERMISSIONS.FEES_READ },
  { path: '/dashboard/accounting', permission: PERMISSIONS.ACCOUNTING_READ },
  { path: '/dashboard/timetable', permission: PERMISSIONS.TIMETABLE_READ },
  { path: '/dashboard/analytics', permission: PERMISSIONS.ANALYTICS_READ },
  { path: '/dashboard/reports', permission: PERMISSIONS.REPORTS_VIEW },
  { path: '/dashboard/documents', permission: PERMISSIONS.DOCUMENTS_READ },
  { path: '/dashboard/certificates', permission: PERMISSIONS.CERTIFICATES_READ },
  { path: '/dashboard/transport', permission: PERMISSIONS.TRANSPORT_READ },
  { path: '/dashboard/biometric', permission: PERMISSIONS.BIOMETRIC_READ },
  { path: '/dashboard/payroll', permission: PERMISSIONS.PAYROLL_READ },
  { path: '/dashboard/parents', permission: PERMISSIONS.STUDENTS_READ },
  { path: '/dashboard/leave-requests', permission: PERMISSIONS.LEAVE_REQUEST },
  { path: '/dashboard/notices', permission: PERMISSIONS.STUDENTS_READ },
  { path: '/dashboard/learning/new', permission: PERMISSIONS.LEARNING_PUBLISH },
  { path: '/dashboard/learning', permission: PERMISSIONS.LEARNING_READ },
  { path: '/dashboard/academic', permission: PERMISSIONS.ACADEMIC_READ },
  { path: '/dashboard/branches/new', permission: PERMISSIONS.BRANCHES_MANAGE },
  { path: '/dashboard/branches', permission: PERMISSIONS.BRANCHES_READ },
  { path: '/dashboard/users/invite', permission: PERMISSIONS.USERS_MANAGE },
  { path: '/dashboard/users', permission: PERMISSIONS.USERS_MANAGE },
  { path: '/dashboard/audit', permission: PERMISSIONS.AUDIT_READ },
  { path: '/dashboard/ai-insights', permission: PERMISSIONS.AI_INSIGHTS_READ },
  { path: '/dashboard/ai-attendance', permission: PERMISSIONS.AI_ATTENDANCE_USE },
  { path: '/dashboard/communications', permission: PERMISSIONS.COMMUNICATIONS_SEND },
  { path: '/dashboard/settings', permission: PERMISSIONS.SETTINGS_MANAGE },
  { path: '/dashboard/form-fields', permission: PERMISSIONS.FORM_FIELDS_MANAGE },
  { path: '/print/report-cards', permission: PERMISSIONS.ASSESSMENTS_READ },
  { path: '/print/certificates', permission: PERMISSIONS.CERTIFICATES_READ },
  { path: '/print/id-cards', permission: PERMISSIONS.CERTIFICATES_READ },
  { path: '/print/salary-slips', permission: PERMISSIONS.PAYROLL_READ },
  { path: '/dashboard', permission: null },
];

/** Special-case: learning edit requires publish permission. */
const LEARNING_EDIT_RE = /^\/dashboard\/learning\/[^/]+\/edit\/?$/;

export function getRequiredPermissionForPath(pathname: string): Permission | null | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/dashboard';

  if (LEARNING_EDIT_RE.test(normalized)) {
    return PERMISSIONS.LEARNING_PUBLISH;
  }

  const sorted = [...ROUTE_PERMISSIONS].sort((a, b) => b.path.length - a.path.length);
  for (const route of sorted) {
    if (normalized === route.path || normalized.startsWith(`${route.path}/`)) {
      return route.permission;
    }
  }

  // Unknown dashboard path — deny by requiring a non-existent check handled as deny
  if (normalized.startsWith('/dashboard')) {
    return undefined;
  }
  return null;
}
