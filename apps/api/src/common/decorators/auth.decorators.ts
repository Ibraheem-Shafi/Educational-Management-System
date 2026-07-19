import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { allBranchScope, type BranchScope } from '@eims/shared';
import type { AuthUser } from '@eims/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

/**
 * Resolved branch scope from BranchGuard.
 * - Super Admin: all | selected (one or many)
 * - Other staff: always selected with their assigned branch
 */
export const BranchScopeParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BranchScope => {
    const request = ctx.switchToHttp().getRequest();
    return (request.branchScope as BranchScope | undefined) ?? allBranchScope();
  },
);

/**
 * Legacy single branch id.
 * - Single-branch scope → that id
 * - All or multi → null (use @BranchScopeParam for multi)
 */
export const BranchId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    return ctx.switchToHttp().getRequest().branchId ?? null;
  },
);

export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Skip MFA AAL2 check (e.g. GET /auth/me during login enrollment). */
export const SKIP_MFA_KEY = 'skipMfa';
export const SkipMfa = () => SetMetadata(SKIP_MFA_KEY, true);
