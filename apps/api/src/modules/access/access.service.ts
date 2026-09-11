import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACCESS_MODULE_GROUPS,
  ACCESS_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  accessFlagsFromCodes,
  catalogOverrideDiff,
  codesFromAccessFlags,
  isLockedStaffRoleCode,
  isPortalRoleCode,
  isSuperAdmin,
  isViewOnlyModule,
  resolveEffectivePermissionCodes,
  uncataloguedPermissionCodes,
  type CreateRoleAccessInput,
  type UpdateRoleAccessInput,
  type UpdateUserAccessInput,
  type UpdateUserRoleInput,
  type BranchScope,
} from '@eims/shared';
import type {
  AccessCatalogResponse,
  AccessRoleSummary,
  AccessRolesResponse,
  AuthUser,
  UserAccessResponse,
} from '@eims/types';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AuthCacheService } from '../../common/auth/auth-cache.service';
import { prismaBranchFilter } from '../../common/utils/branch-scope.util';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authCache: AuthCacheService,
  ) {}

  getCatalog(): AccessCatalogResponse {
    return {
      groups: ACCESS_MODULE_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        modules: ACCESS_MODULES.filter((module) => module.group === group.id).map((module) => ({
          id: module.id,
          label: module.label,
          group: module.group,
          groupLabel: module.groupLabel,
          viewOnly: isViewOnlyModule(module),
        })),
      })),
    };
  }

  async listRoles(): Promise<AccessRolesResponse> {
    const roles = await this.prisma.role.findMany({
      where: { code: { notIn: this.portalCodes() } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    });

    return {
      data: roles.map((role) => this.toRoleSummary(role)),
    };
  }

  async createRole(input: CreateRoleAccessInput, actor: AuthUser): Promise<AccessRoleSummary> {
    const code = await this.uniqueRoleCode(input.name);
    if (isPortalRoleCode(code) || isLockedStaffRoleCode(code)) {
      throw new BadRequestException('That role name is reserved');
    }

    let permissionCodes: string[] = [];
    if (input.copyFromRoleId) {
      const source = await this.prisma.role.findUnique({
        where: { id: input.copyFromRoleId },
        include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
      });
      if (!source) throw new BadRequestException('Template to copy from was not found');
      permissionCodes = source.rolePermissions.map((row) => row.permission.code);
    } else if (input.modules) {
      permissionCodes = codesFromAccessFlags(input.modules);
    }

    const permissionIds = await this.permissionIdsForCodes(permissionCodes);
    const role = await this.prisma.role.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isSystem: false,
        rolePermissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'role.created',
      entityType: 'Role',
      entityId: role.id,
      newValue: { code: role.code, name: role.name, permissionCodes },
    });

    return this.toRoleSummary(role);
  }

  async updateRole(id: string, input: UpdateRoleAccessInput, actor: AuthUser): Promise<AccessRoleSummary> {
    const role = await this.requireEditableRole(id);
    const existingCodes = role.rolePermissions.map((row) => row.permission.code);
    const catalogCodes = codesFromAccessFlags(input.modules);
    const preserved = uncataloguedPermissionCodes(existingCodes);
    const nextCodes = [...new Set([...catalogCodes, ...preserved])];

    await this.replaceRolePermissions(role.id, nextCodes);

    const updated = await this.prisma.role.update({
      where: { id: role.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'role.permissions_updated',
      entityType: 'Role',
      entityId: role.id,
      previousValue: { permissionCodes: existingCodes },
      newValue: { permissionCodes: nextCodes, name: updated.name },
    });

    this.authCache.invalidateAll();
    return this.toRoleSummary(updated);
  }

  async resetRole(id: string, actor: AuthUser): Promise<AccessRoleSummary> {
    const role = await this.requireEditableRole(id);
    const defaults = DEFAULT_ROLE_PERMISSIONS[role.code];
    if (!defaults) {
      throw new BadRequestException('Only built-in templates can be reset to defaults');
    }

    const previous = role.rolePermissions.map((row) => row.permission.code);
    await this.replaceRolePermissions(role.id, defaults);

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { id: role.id },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'role.permissions_reset',
      entityType: 'Role',
      entityId: role.id,
      previousValue: { permissionCodes: previous },
      newValue: { permissionCodes: defaults },
    });

    this.authCache.invalidateAll();
    return this.toRoleSummary(updated);
  }

  async getUserAccess(userId: string, scope: BranchScope): Promise<UserAccessResponse> {
    const user = await this.requireScopedUser(userId, scope);
    return this.toUserAccess(user);
  }

  async updateUserAccess(
    userId: string,
    input: UpdateUserAccessInput,
    actor: AuthUser,
    scope: BranchScope,
  ): Promise<UserAccessResponse> {
    const user = await this.requireScopedUser(userId, scope);
    if (isSuperAdmin(user.userRoles.map((row) => row.role.code))) {
      throw new BadRequestException('Super Admin access cannot be changed');
    }

    const templateCodes = this.rolePermissionCodes(user);
    const desired = codesFromAccessFlags(input.modules);
    const { grants, denies } = catalogOverrideDiff(templateCodes, desired);
    const permissionMap = await this.permissionMapByCode([...new Set([...grants, ...denies])]);

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      if (grants.length + denies.length === 0) return;
      await tx.userPermission.createMany({
        data: [
          ...grants.map((code) => ({
            userId,
            permissionId: permissionMap.get(code)!,
            effect: 'grant',
          })),
          ...denies.map((code) => ({
            userId,
            permissionId: permissionMap.get(code)!,
            effect: 'deny',
          })),
        ].filter((row) => row.permissionId),
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: 'user.access_updated',
      entityType: 'User',
      entityId: userId,
      newValue: { grants, denies },
    });

    this.authCache.invalidateSupabaseUser(user.supabaseUserId);
    const refreshed = await this.requireScopedUser(userId, scope);
    return this.toUserAccess(refreshed);
  }

  async updateUserRole(
    userId: string,
    input: UpdateUserRoleInput,
    actor: AuthUser,
    scope: BranchScope,
  ): Promise<UserAccessResponse> {
    const user = await this.requireScopedUser(userId, scope);
    const currentCodes = user.userRoles.map((row) => row.role.code);
    if (isSuperAdmin(currentCodes)) {
      throw new BadRequestException('Cannot change a Super Admin role');
    }

    const nextRole = await this.prisma.role.findUnique({ where: { id: input.roleId } });
    if (!nextRole) throw new BadRequestException('Invalid role');
    if (isLockedStaffRoleCode(nextRole.code)) {
      throw new BadRequestException('Cannot assign Super Admin from this screen');
    }
    if (isPortalRoleCode(nextRole.code)) {
      throw new BadRequestException('Portal roles cannot be assigned to staff here');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userPermission.deleteMany({ where: { userId } });
      await tx.userRole.create({
        data: { userId, roleId: nextRole.id, branchId: user.branchId },
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: 'user.role_updated',
      entityType: 'User',
      entityId: userId,
      previousValue: { roles: currentCodes },
      newValue: { role: nextRole.code },
    });

    this.authCache.invalidateSupabaseUser(user.supabaseUserId);
    const refreshed = await this.requireScopedUser(userId, scope);
    return this.toUserAccess(refreshed);
  }

  private async requireEditableRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (isLockedStaffRoleCode(role.code) || isPortalRoleCode(role.code)) {
      throw new BadRequestException('This template cannot be edited');
    }
    return role;
  }

  private async requireScopedUser(userId: string, scope: BranchScope) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...prismaBranchFilter(scope),
        OR: [{ deletedAt: null }, { isActive: false }],
      },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                rolePermissions: { include: { permission: { select: { code: true } } } },
              },
            },
          },
        },
        userPermissions: {
          include: { permission: { select: { code: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toUserAccess(user: {
    id: string;
    userRoles: Array<{
      role: {
        id: string;
        code: string;
        name: string;
        rolePermissions: Array<{ permission: { code: string } }>;
      };
    }>;
    userPermissions: Array<{ effect: string; permission: { code: string } }>;
  }): UserAccessResponse {
    const primary = user.userRoles[0]?.role ?? null;
    const templateCodes = this.rolePermissionCodes(user);
    const grants = user.userPermissions.filter((row) => row.effect === 'grant').map((row) => row.permission.code);
    const denies = user.userPermissions.filter((row) => row.effect === 'deny').map((row) => row.permission.code);
    const effectiveCodes = resolveEffectivePermissionCodes({
      isSuperAdmin: isSuperAdmin(user.userRoles.map((row) => row.role.code)),
      roleCodes: templateCodes,
      grants,
      denies,
    });
    const template = accessFlagsFromCodes(templateCodes);
    const effective = accessFlagsFromCodes(effectiveCodes);
    const overrides = effective.map((flag) => {
      const base = template.find((item) => item.moduleId === flag.moduleId);
      return {
        moduleId: flag.moduleId,
        view: flag.view !== Boolean(base?.view),
        edit: flag.edit !== Boolean(base?.edit),
      };
    });
    const differsFromTemplate = overrides.some((flag) => flag.view || flag.edit);

    return {
      userId: user.id,
      role: primary ? { id: primary.id, code: primary.code, name: primary.name } : null,
      isLocked: primary ? isLockedStaffRoleCode(primary.code) : false,
      template,
      effective,
      overrides,
      differsFromTemplate,
    };
  }

  private rolePermissionCodes(user: {
    userRoles: Array<{ role: { rolePermissions: Array<{ permission: { code: string } }> } }>;
  }): string[] {
    const codes = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) codes.add(rp.permission.code);
    }
    return [...codes];
  }

  private toRoleSummary(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    _count: { userRoles: number };
    rolePermissions: Array<{ permission: { code: string } }>;
  }): AccessRoleSummary {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isLocked: isLockedStaffRoleCode(role.code),
      userCount: role._count.userRoles,
      modules: accessFlagsFromCodes(role.rolePermissions.map((row) => row.permission.code)),
    };
  }

  private async replaceRolePermissions(roleId: string, codes: string[]) {
    const permissionIds = await this.permissionIdsForCodes(codes);
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length === 0) return;
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    });
  }

  private async permissionIdsForCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const map = await this.permissionMapByCode(codes);
    return codes.map((code) => map.get(code)).filter((id): id is string => Boolean(id));
  }

  private async permissionMapByCode(codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();
    const rows = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    return new Map(rows.map((row) => [row.code, row.id]));
  }

  private async uniqueRoleCode(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'role';
    if (isPortalRoleCode(base) || isLockedStaffRoleCode(base)) {
      throw new ConflictException('That role name is reserved');
    }
    let candidate = base;
    let n = 2;
    while (await this.prisma.role.findUnique({ where: { code: candidate } })) {
      candidate = `${base}_${n}`.slice(0, 50);
      n += 1;
    }
    return candidate;
  }

  private portalCodes(): string[] {
    return ['parent', 'student'];
  }
}
