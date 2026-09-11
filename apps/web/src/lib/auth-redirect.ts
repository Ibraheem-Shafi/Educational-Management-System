import { isPortalRoleCode } from '@eims/shared';

export function isStaffUser(roles: string[]): boolean {
  return roles.some((role) => !isPortalRoleCode(role));
}

export function getPostLoginPath(roles: string[]): string {
  if (isStaffUser(roles)) return '/dashboard';
  if (roles.includes('parent')) return '/portal/parent';
  if (roles.includes('student')) return '/portal/student';
  return '/dashboard';
}
