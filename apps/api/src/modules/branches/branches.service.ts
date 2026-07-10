import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import type { Branch, AuthUser, BranchesStatsResponse, BranchListRow, BranchDetailResponse, DashboardRecentActivity, PaginatedResponse } from '@eims/types';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from '@eims/shared';
import { computeChangePercent } from '../../common/utils/metrics.util';

const BRANCHES_CACHE_TTL_MS = 300_000;
const STATS_CACHE_TTL_MS = 45_000;

const STAFF_ROLE_CODES = [
  'super_admin',
  'branch_admin',
  'teacher',
  'accountant',
  'receptionist',
] as const;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(branchId: string | null): Promise<BranchesStatsResponse> {
    const cacheKey = `branches:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<BranchesStatsResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildStats(branchId);
    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListBranchesQuery, branchId: string | null) {
    if (query.page !== undefined) {
      return this.findAllPaginated({ ...query, page: query.page }, branchId);
    }
    return this.findAllSimple(branchId);
  }

  private async findAllSimple(branchId: string | null) {
    const cacheKey = `branches:list:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<{ data: Branch[] }>(cacheKey);
    if (cached) return cached;

    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    const result = { data: branches.map(this.toResponse) };
    this.ttlCache.set(cacheKey, result, BRANCHES_CACHE_TTL_MS);
    return result;
  }

  private async findAllPaginated(
    query: ListBranchesQuery & { page: number },
    branchId: string | null,
  ): Promise<PaginatedResponse<BranchListRow>> {
    const where = {
      deletedAt: null,
      ...(branchId ? { id: branchId } : {}),
      ...(query.status === 'active' ? { isActive: true } : {}),
      ...(query.status === 'inactive' ? { isActive: false } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { code: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          city: true,
          phone: true,
          email: true,
          isActive: true,
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    if (branches.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }

    const branchIds = branches.map((branch) => branch.id);

    const [studentCounts, staffCounts, principals] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['branchId'],
        where: { branchId: { in: branchIds }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: branchIds },
          deletedAt: null,
          isActive: true,
          userRoles: { some: { role: { code: { in: [...STAFF_ROLE_CODES] } } } },
        },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: {
          branchId: { in: branchIds },
          deletedAt: null,
          isActive: true,
          userRoles: { some: { role: { code: 'branch_admin' } } },
        },
        select: { branchId: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    const studentsByBranch = new Map(
      studentCounts.map((row) => [row.branchId, row._count._all]),
    );
    const staffByBranch = new Map(staffCounts.map((row) => [row.branchId, row._count._all]));
    const principalByBranch = new Map<string, string>();
    for (const principal of principals) {
      if (principal.branchId && !principalByBranch.has(principal.branchId)) {
        principalByBranch.set(principal.branchId, principal.fullName);
      }
    }

    return {
      data: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        addressLabel: this.formatBranchAddress(branch.city, branch.address),
        email: branch.email,
        phone: branch.phone,
        principalName: principalByBranch.get(branch.id) ?? null,
        studentCount: studentsByBranch.get(branch.id) ?? 0,
        staffCount: staffByBranch.get(branch.id) ?? 0,
        isActive: branch.isActive,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, branchId: string | null): Promise<BranchDetailResponse> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const [studentCount, staffCount, classCount, principal, staff, recentActivities] =
      await Promise.all([
        this.prisma.student.count({
          where: { branchId: branch.id, deletedAt: null },
        }),
        this.prisma.user.count({
          where: {
            branchId: branch.id,
            deletedAt: null,
            isActive: true,
            userRoles: { some: { role: { code: { in: [...STAFF_ROLE_CODES] } } } },
          },
        }),
        this.prisma.batch.count({
          where: { branchId: branch.id, deletedAt: null },
        }),
        this.prisma.user.findFirst({
          where: {
            branchId: branch.id,
            deletedAt: null,
            isActive: true,
            userRoles: { some: { role: { code: 'branch_admin' } } },
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            gender: true,
          },
          orderBy: { fullName: 'asc' },
        }),
        this.prisma.user.findMany({
          where: {
            branchId: branch.id,
            deletedAt: null,
            isActive: true,
            userRoles: { some: { role: { code: { in: [...STAFF_ROLE_CODES] } } } },
          },
          select: {
            id: true,
            fullName: true,
            gender: true,
            userRoles: {
              select: { role: { select: { name: true } } },
              take: 1,
            },
          },
          orderBy: { fullName: 'asc' },
          take: 12,
        }),
        this.buildBranchRecentActivities(branch.id),
      ]);

    return {
      ...this.toResponse(branch),
      addressLabel: this.formatBranchAddress(branch.city, branch.address),
      principalName: principal?.fullName ?? null,
      principal: principal
        ? {
            id: principal.id,
            fullName: principal.fullName,
            email: principal.email,
            phone: principal.phone,
            gender: principal.gender,
          }
        : null,
      studentCount,
      staffCount,
      classCount,
      staff: staff.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        roleName: member.userRoles[0]?.role.name ?? 'Staff',
        gender: member.gender,
      })),
      recentActivities,
    };
  }

  private async buildBranchRecentActivities(
    branchId: string,
  ): Promise<DashboardRecentActivity[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    const [students, staff, paidInvoices, attendanceGroups] = await Promise.all([
      this.prisma.student.findMany({
        where: { branchId, deletedAt: null, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, fullName: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: {
          branchId,
          deletedAt: null,
          createdAt: { gte: since },
          userRoles: { some: { role: { code: { in: [...STAFF_ROLE_CODES] } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, fullName: true, createdAt: true },
      }),
      this.prisma.feeInvoice.findMany({
        where: { branchId, paidAt: { not: null, gte: since } },
        orderBy: { paidAt: 'desc' },
        take: 4,
        select: { id: true, netAmount: true, paidAt: true },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['date'],
        where: {
          branchId,
          entityType: 'student',
          createdAt: { gte: since },
        },
        _count: { _all: true },
        orderBy: { date: 'desc' },
        take: 4,
      }),
    ]);

    const drafts: Array<{
      id: string;
      title: string;
      description: string;
      kind: DashboardRecentActivity['kind'];
      occurredAt: Date;
    }> = [];

    for (const student of students) {
      drafts.push({
        id: `student-${student.id}`,
        title: 'New student admitted',
        description: student.fullName,
        kind: 'student',
        occurredAt: student.createdAt,
      });
    }

    for (const member of staff) {
      drafts.push({
        id: `staff-${member.id}`,
        title: 'New staff added',
        description: member.fullName,
        kind: 'teacher',
        occurredAt: member.createdAt,
      });
    }

    for (const invoice of paidInvoices) {
      if (!invoice.paidAt) continue;
      drafts.push({
        id: `fee-${invoice.id}`,
        title: 'Fee updated',
        description: `PKR ${Number(invoice.netAmount).toLocaleString('en-US')}`,
        kind: 'fee',
        occurredAt: invoice.paidAt,
      });
    }

    for (const group of attendanceGroups) {
      drafts.push({
        id: `attendance-${branchId}-${group.date.toISOString().slice(0, 10)}`,
        title: `${group._count._all} students marked attendance`,
        description: group.date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        kind: 'attendance',
        occurredAt: group.date,
      });
    }

    return drafts
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 5)
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        kind: activity.kind,
        occurredAt: activity.occurredAt.toISOString(),
      }));
  }

  async create(input: CreateBranchInput, user: AuthUser) {
    const existing = await this.prisma.branch.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: {
        name: input.name,
        code: input.code,
        address: input.address,
        city: input.city,
        phone: input.phone,
        email: input.email,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.created',
      entityType: 'Branch',
      entityId: branch.id,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  async update(
    id: string,
    input: UpdateBranchInput,
    branchId: string | null,
    user: AuthUser,
  ) {
    const existing = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    if (input.code && input.code !== existing.code) {
      const codeTaken = await this.prisma.branch.findFirst({
        where: { code: input.code, deletedAt: null, NOT: { id } },
      });
      if (codeTaken) throw new ConflictException('Branch code already exists');
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.updated',
      entityType: 'Branch',
      entityId: branch.id,
      previousValue: existing,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  async deactivate(id: string, branchId: string | null, user: AuthUser) {
    const existing = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { id: branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    const branch = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.deactivated',
      entityType: 'Branch',
      entityId: branch.id,
      previousValue: existing,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  private invalidateBranchesCache(): void {
    this.ttlCache.deleteByPrefix('branches:');
  }

  private async buildStats(branchId: string | null): Promise<BranchesStatsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const branchWhere = {
      deletedAt: null,
      ...(branchId ? { id: branchId } : {}),
    };
    const branchWherePrevious = {
      ...branchWhere,
      createdAt: { lte: thirtyDaysAgo },
    };
    const activeBranchWhere = { ...branchWhere, isActive: true };
    const activeBranchWherePrevious = { ...branchWherePrevious, isActive: true };
    const inactiveBranchWhere = { ...branchWhere, isActive: false };
    const inactiveBranchWherePrevious = { ...branchWherePrevious, isActive: false };

    const studentWhere = { deletedAt: null, ...(branchId ? { branchId } : {}) };
    const studentWherePrevious = { ...studentWhere, createdAt: { lte: thirtyDaysAgo } };

    const [
      totalBranches,
      totalBranchesPrevious,
      activeBranches,
      activeBranchesPrevious,
      inactiveBranches,
      inactiveBranchesPrevious,
      totalStudents,
      totalStudentsPrevious,
    ] = await Promise.all([
      this.prisma.branch.count({ where: branchWhere }),
      this.prisma.branch.count({ where: branchWherePrevious }),
      this.prisma.branch.count({ where: activeBranchWhere }),
      this.prisma.branch.count({ where: activeBranchWherePrevious }),
      this.prisma.branch.count({ where: inactiveBranchWhere }),
      this.prisma.branch.count({ where: inactiveBranchWherePrevious }),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.count({ where: studentWherePrevious }),
    ]);

    return {
      totalBranches: {
        total: totalBranches,
        changePercent: computeChangePercent(totalBranches, totalBranchesPrevious),
      },
      activeBranches: {
        total: activeBranches,
        changePercent: computeChangePercent(activeBranches, activeBranchesPrevious),
      },
      inactiveBranches: {
        total: inactiveBranches,
        changePercent: computeChangePercent(inactiveBranches, inactiveBranchesPrevious),
      },
      totalStudents: {
        total: totalStudents,
        changePercent: computeChangePercent(totalStudents, totalStudentsPrevious),
      },
    };
  }

  private formatBranchAddress(city: string | null, address: string | null): string {
    if (city && address) {
      const locality = address.split(',')[0]?.trim() || address;
      return `${city}, ${locality}`;
    }
    return city ?? address ?? '—';
  }

  private toResponse(branch: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Branch {
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      email: branch.email,
      isActive: branch.isActive,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
    };
  }
}
