import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BranchScope } from '@eims/shared';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import type { AuthUser, PaginatedResponse, ParentsStatsResponse } from '@eims/types';
import type { CreateParentInput, ListParentsQuery, LinkParentStudentInput, ListParentStudentsQuery, ListStudentParentsQuery } from '@eims/shared';
import { paginatedResult } from '../../common/utils/pagination.util';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  /** Parents visible under branch scope (via linked students). */
  private parentWhereForScope(scope: BranchScope): Prisma.ParentWhereInput {
    if (scope.kind === 'all') {
      return { deletedAt: null };
    }
    return {
      deletedAt: null,
      studentParents: {
        some: {
          student: {
            deletedAt: null,
            ...prismaBranchFilter(scope),
          },
        },
      },
    };
  }

  private studentLinkWhere(scope: BranchScope): Prisma.StudentParentWhereInput {
    if (scope.kind === 'all') return {};
    return {
      student: {
        deletedAt: null,
        ...prismaBranchFilter(scope),
      },
    };
  }

  private studentParentsInclude(scope: BranchScope) {
    const branchFilter = prismaBranchFilter(scope);
    const scoped =
      scope.kind === 'selected'
        ? {
            where: {
              student: {
                deletedAt: null,
                ...branchFilter,
              },
            },
          }
        : {};

    return {
      studentParents: {
        ...scoped,
        include: {
          student: { select: { id: true, fullName: true, branchId: true } },
        },
      },
    };
  }

  async getStats(scope: BranchScope): Promise<ParentsStatsResponse> {
    const cacheKey = `parents:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<ParentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const thirtyAgo = thirtyDaysAgo();
    const base = this.parentWhereForScope(scope);
    const linkWhere = this.studentLinkWhere(scope);

    const [totalParents, totalParentsPrev, links, newParents, newParentsPrev] =
      await Promise.all([
        this.prisma.parent.count({ where: base }),
        this.prisma.parent.count({ where: { ...base, createdAt: { lte: thirtyAgo } } }),
        this.prisma.studentParent.count({ where: linkWhere }),
        this.prisma.parent.count({ where: { ...base, createdAt: { gte: thirtyAgo } } }),
        this.prisma.parent.count({
          where: {
            ...base,
            createdAt: {
              gte: new Date(thirtyAgo.getTime() - 30 * 86400000),
              lt: thirtyAgo,
            },
          },
        }),
      ]);

    let unlinked = 0;
    if (scope.kind === 'all') {
      const parentsWithLinks = await this.prisma.parent.count({
        where: { deletedAt: null, studentParents: { some: {} } },
      });
      unlinked = totalParents - parentsWithLinks;
    }

    const result: ParentsStatsResponse = {
      totalParents: countWithTrend(totalParents, totalParentsPrev),
      linkedStudents: countWithTrend(links, 0),
      unlinkedParents: countWithTrend(unlinked, 0),
      newLast30Days: countWithTrend(newParents, newParentsPrev),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  private invalidateParentsCache(): void {
    this.ttlCache.deleteByPrefix('parents:');
  }

  async findAll(
    query: ListParentsQuery,
    scope: BranchScope,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where: Prisma.ParentWhereInput = {
      ...this.parentWhereForScope(scope),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search.replace(/^PAR-/i, ''), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [parents, total] = await Promise.all([
      this.prisma.parent.findMany({
        where,
        include: this.studentParentsInclude(scope),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parent.count({ where }),
    ]);

    return {
      data: parents.map((p) => this.toResponse(p)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, scope: BranchScope) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, ...this.parentWhereForScope(scope) },
      include: this.studentParentsInclude(scope),
    });
    if (!parent) throw new NotFoundException('Parent not found');
    return this.toResponse(parent);
  }

  async create(input: CreateParentInput, user: AuthUser, scope: BranchScope) {
    const parent = await this.prisma.parent.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        cnic: input.cnic,
      },
    });

    if (input.studentId && input.relationshipCode) {
      await this.linkStudent(
        parent.id,
        {
          studentId: input.studentId,
          relationshipCode: input.relationshipCode,
        },
        user,
        scope,
      );
    } else {
      this.invalidateParentsCache();
    }

    await this.audit.log({
      userId: user.id,
      action: 'parent.created',
      entityType: 'Parent',
      entityId: parent.id,
      newValue: parent,
    });

    // Newly created unlinked parent is only visible under all-branches scope.
    if (scope.kind === 'selected' && !(input.studentId && input.relationshipCode)) {
      return this.findOne(parent.id, { kind: 'all' });
    }
    return this.findOne(parent.id, scope);
  }

  async linkStudent(
    parentId: string,
    input: LinkParentStudentInput,
    user: AuthUser,
    scope: BranchScope = { kind: 'all' },
  ) {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, deletedAt: null },
    });
    if (!parent) throw new NotFoundException('Parent not found');

    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, deletedAt: null },
    });
    if (!student) throw new BadRequestException('Student not found');

    const existing = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId: input.studentId, parentId } },
    });
    if (existing) throw new ConflictException('Parent already linked to this student');

    const link = await this.prisma.studentParent.create({
      data: {
        parentId,
        studentId: input.studentId,
        relationshipCode: input.relationshipCode,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'parent.student_linked',
      entityType: 'StudentParent',
      entityId: link.id,
      newValue: link,
    });

    this.invalidateParentsCache();
    return this.findOne(parentId, scope);
  }

  async unlinkStudent(parentId: string, studentId: string, user: AuthUser) {
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId } },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.studentParent.delete({ where: { id: link.id } });

    await this.audit.log({
      userId: user.id,
      action: 'parent.student_unlinked',
      entityType: 'StudentParent',
      entityId: link.id,
      previousValue: link,
    });

    this.invalidateParentsCache();
    return { success: true };
  }

  async listLinkedStudents(
    parentId: string,
    query: ListParentStudentsQuery,
    scope: BranchScope,
  ) {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, ...this.parentWhereForScope(scope) },
    });
    if (!parent) throw new NotFoundException('Parent not found');

    const where: Prisma.StudentParentWhereInput = {
      parentId,
      ...this.studentLinkWhere(scope),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [links, total] = await Promise.all([
      this.prisma.studentParent.findMany({
        where,
        include: { student: { select: { id: true, fullName: true } } },
        orderBy: { student: { fullName: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.studentParent.count({ where }),
    ]);

    return paginatedResult(
      links.map((sp) => ({
        linkId: sp.id,
        relationshipCode: sp.relationshipCode,
        student: sp.student,
      })),
      total,
      page,
      limit,
    );
  }

  async getStudentParents(studentId: string, query: ListStudentParentsQuery = { page: 1, limit: 8 }) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const where = { studentId };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [links, total] = await Promise.all([
      this.prisma.studentParent.findMany({
        where,
        include: { parent: true },
        orderBy: { parent: { fullName: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.studentParent.count({ where }),
    ]);

    return paginatedResult(
      links.map((l) => ({
        ...this.toParentSummary(l.parent),
        relationshipCode: l.relationshipCode,
        linkId: l.id,
      })),
      total,
      page,
      limit,
    );
  }

  private toParentSummary(parent: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  }) {
    return {
      id: parent.id,
      fullName: parent.fullName,
      phone: parent.phone,
      email: parent.email,
    };
  }

  private toResponse(parent: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    cnic: string | null;
    createdAt: Date;
    studentParents: Array<{
      id: string;
      relationshipCode: string;
      student: { id: string; fullName: string; branchId?: string };
    }>;
  }) {
    return {
      id: parent.id,
      fullName: parent.fullName,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      cnic: parent.cnic,
      students: parent.studentParents.map((sp) => ({
        linkId: sp.id,
        relationshipCode: sp.relationshipCode,
        student: sp.student,
      })),
      createdAt: parent.createdAt.toISOString(),
    };
  }
}
