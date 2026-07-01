const STAFF_ROLES = ['super_admin', 'branch_admin', 'teacher', 'accountant', 'receptionist'];

export function getPostLoginPath(roles: string[]): string {
  if (roles.some((r) => STAFF_ROLES.includes(r))) return '/dashboard';
  if (roles.includes('parent')) return '/portal/parent';
  if (roles.includes('student')) return '/portal/student';
  return '/dashboard';
}

export function isStaffUser(roles: string[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}
