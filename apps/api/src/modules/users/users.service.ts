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
import type { AuthUser, PaginatedResponse } from '@eims/types';
import type { ListUsersQuery, CreateInvitationInput, UpdateUserInput } from '@eims/shared';

const INVITATION_EXPIRY_DAYS = 7;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly authCache: AuthCacheService,
  ) {}

  async findAll(query: ListUsersQuery, branchId: string | null): Promise<PaginatedResponse<Record<string, unknown>>> {
    const effectiveBranchId = branchId ?? query.branchId;
    const where = {
      deletedAt: null,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

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
      data: users.map((u) => this.toUserResponse(u)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, branchId: string | null) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async update(id: string, input: { isActive?: boolean }, actor: AuthUser, branchId: string | null) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.id === actor.id) throw new BadRequestException('Cannot deactivate your own account');

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isActive === false ? { deletedAt: new Date() } : { deletedAt: null }),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
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

  private toUserResponse(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    branchId: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    branch?: { id: string; name: string; code: string } | null;
    userRoles: Array<{ role: { id: string; code: string; name: string } }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      branchId: user.branchId,
      branch: user.branch,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
