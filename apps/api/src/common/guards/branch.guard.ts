import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '@eims/types';

@Injectable()
export class BranchGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return true;

    if (user.roles.includes('super_admin')) {
      request.branchId =
        request.query?.branchId ?? request.body?.branchId ?? user.branchId ?? null;
      return true;
    }

    if (!user.branchId) throw new ForbiddenException('No branch assigned');
    request.branchId = user.branchId;
    return true;
  }
}
