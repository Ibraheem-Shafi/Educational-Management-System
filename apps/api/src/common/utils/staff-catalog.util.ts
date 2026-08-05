import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@eims/types';

const PORTAL_ROLES = new Set(['parent', 'student']);

/**
 * Branch-scoped catalog endpoints (students/batches/programs options) are for
 * staff dropdowns only — not parent/student portal users.
 */
export function assertStaffCatalogAccess(user: AuthUser): void {
  if (user.roles.some((role) => PORTAL_ROLES.has(role))) {
    throw new ForbiddenException('Insufficient permissions');
  }
}
