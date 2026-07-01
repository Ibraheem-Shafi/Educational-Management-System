import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser } from '@eims/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

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
