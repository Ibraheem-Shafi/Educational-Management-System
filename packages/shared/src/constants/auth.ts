/** Roles that must enroll TOTP and complete AAL2 at login (docs/12-security.md). */
export const MFA_REQUIRED_ROLES = ['super_admin', 'branch_admin'] as const;

export const SUPER_ADMIN_ROLE = 'super_admin' as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

export function requiresMfaPolicy(roles: string[]): boolean {
  return roles.some((r) => (MFA_REQUIRED_ROLES as readonly string[]).includes(r));
}

/** Application owner — must never be treated as disabled / deactivated. */
export function isSuperAdmin(roles: string[]): boolean {
  return roles.includes(SUPER_ADMIN_ROLE);
}

/** Roles that may work across campuses when `User.branchId` is null (invite: All branches). */
export const ALL_BRANCHES_ROLES = [
  SUPER_ADMIN_ROLE,
  'accountant',
  'fee_collector',
  'hr_finance',
] as const;

export type AllBranchesRole = (typeof ALL_BRANCHES_ROLES)[number];

export function canSelectAllBranches(roles: string[]): boolean {
  return roles.some((r) => (ALL_BRANCHES_ROLES as readonly string[]).includes(r));
}
