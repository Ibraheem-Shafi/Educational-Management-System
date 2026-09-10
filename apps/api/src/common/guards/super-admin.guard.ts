import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isSuperAdmin } from '@eims/shared';
import type { AuthUser } from '@eims/types';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !isSuperAdmin(user.roles)) {
      throw new ForbiddenException('Only Super Admin can manage access templates');
    }
    return true;
  }
}
