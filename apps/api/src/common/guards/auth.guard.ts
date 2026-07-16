import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { requiresMfaPolicy, isSuperAdmin } from '@eims/shared';
import { PrismaService } from '../../prisma/prisma.module';
import { IS_PUBLIC_KEY, SKIP_MFA_KEY } from '../decorators/auth.decorators';
import { getJwtAal } from '../utils/jwt.util';
import { AuthCacheService } from '../auth/auth-cache.service';
import { JwtVerifyService } from '../auth/jwt-verify.service';
import type { AuthUser } from '@eims/types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly jwtVerify: JwtVerifyService,
    private readonly authCache: AuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    const verified = await this.jwtVerify.verifyAccessToken(token);
    if (!verified) throw new UnauthorizedException();

    let authUser: AuthUser & { isActive: boolean };

    const cached = this.authCache.getBySupabaseUserId(verified.supabaseUserId);
    if (cached) {
      authUser = cached;
      // Super Admin is never blocked by a stale inactive cache entry.
      if (!authUser.isActive && isSuperAdmin(authUser.roles)) {
        authUser = { ...authUser, isActive: true };
      } else if (!authUser.isActive) {
        throw new UnauthorizedException('Account disabled');
      }
    } else {
      const appUser = await this.prisma.user.findUnique({
        where: { supabaseUserId: verified.supabaseUserId },
        select: {
          id: true,
          supabaseUserId: true,
          email: true,
          fullName: true,
          branchId: true,
          isActive: true,
          userRoles: {
            select: {
              role: {
                select: {
                  code: true,
                  rolePermissions: {
                    select: { permission: { select: { code: true } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!appUser) throw new UnauthorizedException('User account not found');

      const roles = appUser.userRoles.map((ur) => ur.role.code);
      const superAdmin = isSuperAdmin(roles);

      if (!appUser.isActive && !superAdmin) {
        throw new UnauthorizedException('Account disabled');
      }

      // Heal Super Admin if somehow marked inactive — owner must always be able to sign in.
      if (superAdmin && !appUser.isActive) {
        await this.prisma.user.update({
          where: { id: appUser.id },
          data: { isActive: true, deletedAt: null },
        });
      }

      const permissionSet = new Set<string>();
      for (const ur of appUser.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          permissionSet.add(rp.permission.code);
        }
      }

      authUser = {
        id: appUser.id,
        supabaseUserId: appUser.supabaseUserId,
        email: appUser.email,
        fullName: appUser.fullName,
        branchId: appUser.branchId,
        roles,
        permissions: Array.from(permissionSet),
        isActive: superAdmin ? true : appUser.isActive,
      };

      this.authCache.setBySupabaseUserId(verified.supabaseUserId, authUser);
    }

    if (
      !skipMfa &&
      !this.isAdminMfaSkipped() &&
      requiresMfaPolicy(authUser.roles) &&
      getJwtAal(token) !== 'aal2'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'MFA verification required',
        error: 'MFA_REQUIRED',
      });
    }

    const { isActive: _isActive, ...userForRequest } = authUser;
    request.user = userForRequest;
    return true;
  }

  private extractToken(request: { headers: { authorization?: string } }): string | null {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  private isAdminMfaSkipped(): boolean {
    return this.config.get('SKIP_ADMIN_MFA') === '1';
  }
}
