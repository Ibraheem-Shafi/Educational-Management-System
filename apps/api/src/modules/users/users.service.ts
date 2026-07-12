import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../../common/email/email.service';
import { AuthCacheService } from '../../common/auth/auth-cache.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import type {
  AuthUser,
  PaginatedResponse,
  StaffListRow,
  UserDetailResponse,
  UserPermissionDetail,
  UsersStatsResponse,
} from '@eims/types';
import type { ListUsersQuery, CreateInvitationInput, UpdateUserInput } from '@eims/shared';
import { isSuperAdmin } from '@eims/shared';
import { computeChangePercent } from '../../common/utils/metrics.util';

const INVITATION_EXPIRY_DAYS = 7;
const STATS_CACHE_TTL_MS = 45_000;

const userDetailInclude = {
  branch: { select: { id: true, name: true, code: true } },
  userRoles: {
    include: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          rolePermissions: {
            include: {
              permission: { select: { code: true, name: true, module: true } },
            },
          },
        },
      },
    },
  },
} as const;

type UserDetailRecord = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  gender: string | null;
  cnic: string | null;
  branchId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  branch: { id: string; name: string; code: string } | null;
  userRoles: Array<{
    role: {
      id: string;
      code: string;
      name: string;
      description: string | null;
      rolePermissions: Array<{
        permission: { code: string; name: string; module: string };
      }>;
    };
  }>;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly authCache: AuthCacheService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(branchId: string | null): Promise<UsersStatsResponse> {
    const cacheKey = `users:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<UsersStatsResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildStats(branchId);
    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListUsersQuery, branchId: string | null): Promise<PaginatedResponse<StaffListRow>> {
    const effectiveBranchId = branchId ?? query.branchId ?? null;

    if (query.status === 'invited') {
      return this.findInvitationsPaginated(query, effectiveBranchId);
    }

    if (query.status === 'active' || query.status === 'inactive') {
      return this.findUsersPaginated(query, effectiveBranchId, query.status);
    }

    return this.findStaffCombined(query, effectiveBranchId);
  }

  private async findUsersPaginated(
    query: ListUsersQuery,
    effectiveBranchId: string | null,
    status: 'active' | 'inactive',
  ): Promise<PaginatedResponse<StaffListRow>> {
    const where = this.buildUserWhere(query, effectiveBranchId, status);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.toStaffRow(user)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async findInvitationsPaginated(
    query: ListUsersQuery,
    effectiveBranchId: string | null,
  ): Promise<PaginatedResponse<StaffListRow>> {
    const where = {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [invitations, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    const roleIds = [...new Set(invitations.map((inv) => inv.roleId))];
    const branchIds = [...new Set(invitations.map((inv) => inv.branchId).filter(Boolean))] as string[];

    const [roles, branches] = await Promise.all([
      roleIds.length
        ? this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true, name: true },
          })
        : [],
      branchIds.length
        ? this.prisma.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const roleMap = new Map(roles.map((role) => [role.id, role.name]));
    const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));

    return {
      data: invitations.map((invitation) =>
        this.toInvitationStaffRow(invitation, roleMap.get(invitation.roleId) ?? '—', invitation.branchId ? branchMap.get(invitation.branchId) ?? null : null),
      ),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async findStaffCombined(
    query: ListUsersQuery,
    effectiveBranchId: string | null,
  ): Promise<PaginatedResponse<StaffListRow>> {
    const userWhere = this.buildUserWhere(query, effectiveBranchId);
    const invitationWhere = {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.invitation.findMany({ where: invitationWhere, orderBy: { createdAt: 'desc' } }),
    ]);

    const roleIds = [...new Set(invitations.map((inv) => inv.roleId))];
    const branchIds = [...new Set(invitations.map((inv) => inv.branchId).filter(Boolean))] as string[];

    const [roles, branches] = await Promise.all([
      roleIds.length
        ? this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true, name: true },
          })
        : [],
      branchIds.length
        ? this.prisma.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const roleMap = new Map(roles.map((role) => [role.id, role.name]));
    const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));

    let rows: StaffListRow[] = [
      ...users.map((user) => this.toStaffRow(user)),
      ...invitations.map((invitation) =>
        this.toInvitationStaffRow(
          invitation,
          roleMap.get(invitation.roleId) ?? '—',
          invitation.branchId ? branchMap.get(invitation.branchId) ?? null : null,
        ),
      ),
    ];

    if (query.roleId) {
      rows = rows.filter((row) => row.roleId === query.roleId);
    }

    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.fullName.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          row.staffCode.toLowerCase().includes(term) ||
          row.id.toLowerCase().includes(term),
      );
    }

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

    const total = rows.length;
    const start = (query.page - 1) * query.limit;
    const data = rows.slice(start, start + query.limit);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private buildUserWhere(
    query: ListUsersQuery,
    effectiveBranchId: string | null,
    status?: 'active' | 'inactive',
  ) {
    return {
      deletedAt: null,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
      ...(query.roleId ? { userRoles: { some: { roleId: query.roleId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  async findOne(id: string, branchId: string | null): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: userDetailInclude,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async update(
    id: string,
    input: UpdateUserInput,
    actor: AuthUser,
    branchId: string | null,
  ): Promise<UserDetailResponse> {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { userRoles: { include: { role: { select: { code: true } } } } },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.id === actor.id && input.isActive === false) {
      throw new BadRequestException('Cannot deactivate your own account');
    }
    const targetRoles = existing.userRoles.map((ur) => ur.role.code);
    if (input.isActive === false && isSuperAdmin(targetRoles)) {
      throw new BadRequestException('Cannot deactivate a Super Admin account');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.cnic !== undefined ? { cnic: input.cnic } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isActive === false ? { deletedAt: new Date() } : {}),
        ...(input.isActive === true ? { deletedAt: null } : {}),
      },
      include: userDetailInclude,
    });

    await this.audit.log({
      userId: actor.id,
      action: input.isActive === false ? 'user.deactivated' : 'user.updated',
      entityType: 'User',
      entityId: id,
      previousValue: existing,
      newValue: user,
    });

    this.authCache.invalidateSupabaseUser(existing.supabaseUserId);
    this.invalidateUsersCache();
    return this.toUserResponse(user);
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, description: true },
    });
    return { data: roles };
  }

  async listInvitations(branchId: string | null) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const roleIds = [...new Set(invitations.map((i) => i.roleId))];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, code: true, name: true },
    });
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    return {
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        roleId: inv.roleId,
        role: roleMap.get(inv.roleId) ?? null,
        branchId: inv.branchId,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    };
  }

  async createInvitation(input: CreateInvitationInput, user: AuthUser) {
    const role = await this.prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new BadRequestException('Invalid role');

    const existingUser = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });
    if (existingUser) throw new ConflictException('User with this email already exists');

    const pendingInvite = await this.prisma.invitation.findFirst({
      where: {
        email: input.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) throw new ConflictException('Pending invitation already exists for this email');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: input.email,
        roleId: input.roleId,
        branchId: input.branchId,
        token,
        expiresAt,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'invitation.created',
      entityType: 'Invitation',
      entityId: invitation.id,
      newValue: { email: invitation.email, roleId: invitation.roleId },
    });

    const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    const settings = await this.prisma.institutionSettings.findUnique({ where: { id: 'default' } });
    const inviteUrl = `${webUrl}/accept-invite?token=${invitation.token}`;
    await this.email.sendInvitationEmail(
      invitation.email,
      inviteUrl,
      settings?.name ?? 'Institution',
      settings?.primaryColor ?? '#2563eb',
    );

    this.invalidateUsersCache();

    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      branchId: invitation.branchId,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  private invalidateUsersCache(): void {
    this.ttlCache.deleteByPrefix('users:stats:');
  }

  private async buildStats(branchId: string | null): Promise<UsersStatsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const userWhere = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };
    const userWherePrevious = {
      ...userWhere,
      createdAt: { lte: thirtyDaysAgo },
    };
    const activeWhere = { ...userWhere, isActive: true };
    const activeWherePrevious = { ...userWherePrevious, isActive: true };
    const inactiveWhere = { ...userWhere, isActive: false };
    const inactiveWherePrevious = { ...userWherePrevious, isActive: false };
    const invitationWhere = {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      ...(branchId ? { branchId } : {}),
    };

    const [
      totalUsers,
      totalUsersPrevious,
      activeUsers,
      activeUsersPrevious,
      inactiveUsers,
      inactiveUsersPrevious,
      pendingInvitations,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.user.count({ where: userWherePrevious }),
      this.prisma.user.count({ where: activeWhere }),
      this.prisma.user.count({ where: activeWherePrevious }),
      this.prisma.user.count({ where: inactiveWhere }),
      this.prisma.user.count({ where: inactiveWherePrevious }),
      this.prisma.invitation.count({ where: invitationWhere }),
    ]);

    return {
      totalUsers: {
        total: totalUsers,
        changePercent: computeChangePercent(totalUsers, totalUsersPrevious),
      },
      activeUsers: {
        total: activeUsers,
        changePercent: computeChangePercent(activeUsers, activeUsersPrevious),
      },
      inactiveUsers: {
        total: inactiveUsers,
        changePercent: computeChangePercent(inactiveUsers, inactiveUsersPrevious),
      },
      pendingInvitations: {
        total: pendingInvitations,
        changePercent: null,
      },
    };
  }

  private formatStaffCode(id: string): string {
    return `STF-${id.slice(-6).toUpperCase()}`;
  }

  private toStaffRow(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    gender: string | null;
    cnic: string | null;
    isActive: boolean;
    branch?: { name: string } | null;
    userRoles: Array<{ role: { id: string; code: string; name: string } }>;
  }): StaffListRow {
    const primaryRole = user.userRoles[0]?.role;
    return {
      id: user.id,
      staffCode: this.formatStaffCode(user.id),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      cnic: user.cnic,
      gender: user.gender,
      branchName: user.branch?.name ?? 'All branches',
      roleName: primaryRole?.name ?? '—',
      roleCode: primaryRole?.code ?? null,
      roleId: primaryRole?.id ?? null,
      status: user.isActive ? 'active' : 'inactive',
      isInvitation: false,
    };
  }

  private toInvitationStaffRow(
    invitation: { id: string; email: string; roleId: string },
    roleName: string,
    branchName: string | null,
    roleCode?: string | null,
  ): StaffListRow {
    const localName = invitation.email.split('@')[0]?.replace(/[._]/g, ' ') ?? invitation.email;
    const displayName = localName
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return {
      id: invitation.id,
      staffCode: this.formatStaffCode(invitation.id),
      fullName: displayName || invitation.email,
      email: invitation.email,
      phone: null,
      cnic: null,
      gender: null,
      branchName: branchName ?? 'All branches',
      roleName,
      roleCode: roleCode ?? null,
      roleId: invitation.roleId,
      status: 'invited',
      isInvitation: true,
    };
  }

  private collectPermissions(
    userRoles: UserDetailRecord['userRoles'],
  ): UserPermissionDetail[] {
    const byCode = new Map<string, UserPermissionDetail>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        const permission = rp.permission;
        if (!byCode.has(permission.code)) {
          byCode.set(permission.code, {
            code: permission.code,
            name: permission.name,
            module: permission.module,
          });
        }
      }
    }
    return [...byCode.values()].sort((a, b) => {
      const moduleCmp = a.module.localeCompare(b.module);
      if (moduleCmp !== 0) return moduleCmp;
      return a.code.localeCompare(b.code);
    });
  }

  private toUserResponse(user: UserDetailRecord): UserDetailResponse {
    return {
      id: user.id,
      staffCode: this.formatStaffCode(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      cnic: user.cnic,
      branchId: user.branchId,
      branch: user.branch,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        description: ur.role.description,
      })),
      permissions: this.collectPermissions(user.userRoles),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
