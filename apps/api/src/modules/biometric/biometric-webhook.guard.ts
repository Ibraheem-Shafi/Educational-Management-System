import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.module';
import { AuthCacheService, type CachedAuthContext } from '../../common/auth/auth-cache.service';
import { JwtVerifyService } from '../../common/auth/jwt-verify.service';
import { isSuperAdmin } from '@eims/shared';

@Injectable()
export class BiometricWebhookGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtVerify: JwtVerifyService,
    private readonly authCache: AuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const configuredSecret = this.config.get<string>('BIOMETRIC_WEBHOOK_SECRET');
    const request = context.switchToHttp().getRequest();

    if (configuredSecret) {
      const header = request.headers['x-biometric-webhook-secret'];
      if (header !== configuredSecret) {
        throw new UnauthorizedException('Invalid biometric webhook secret');
      }
      return true;
    }

    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    const verified = await this.jwtVerify.verifyAccessToken(token);
    if (!verified) throw new UnauthorizedException();

    let authUser: CachedAuthContext | null =
      this.authCache.getBySupabaseUserId(verified.supabaseUserId) ?? null;
    if (!authUser) {
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
      if (!appUser.isActive && !isSuperAdmin(roles)) {
        throw new UnauthorizedException('Account disabled');
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
        isActive: isSuperAdmin(roles) ? true : appUser.isActive,
      };
      this.authCache.setBySupabaseUserId(verified.supabaseUserId, authUser);
    }

    if (!authUser.isActive && !isSuperAdmin(authUser.roles)) {
      throw new UnauthorizedException('Account disabled');
    }

    if (!authUser.permissions.includes('biometric.manage')) {
      throw new ForbiddenException('Insufficient permissions');
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
}
