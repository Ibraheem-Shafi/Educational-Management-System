import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, PaginatedResponse, ParentsStatsResponse } from '@eims/types';
import type { CreateParentInput, ListParentsQuery, LinkParentStudentInput } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(): Promise<ParentsStatsResponse> {
    const cacheKey = 'parents:stats';
    const cached = this.ttlCache.get<ParentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const thirtyAgo = thirtyDaysAgo();
    const base = { deletedAt: null };

    const [totalParents, totalParentsPrev, links, newParents, newParentsPrev] =
      await Promise.all([
        this.prisma.parent.count({ where: base }),
        this.prisma.parent.count({ where: { ...base, createdAt: { lte: thirtyAgo } } }),
        this.prisma.studentParent.count(),
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

    const parentsWithLinks = await this.prisma.parent.count({
      where: { ...base, studentParents: { some: {} } },
    });
    const unlinked = totalParents - parentsWithLinks;

    const result: ParentsStatsResponse = {
      totalParents: countWithTrend(totalParents, totalParentsPrev),
      linkedStudents: countWithTrend(links, 0),
      unlinkedParents: countWithTrend(unlinked, 0),
      newLast30Days: countWithTrend(newParents, newParentsPrev),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListParentsQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [parents, total] = await Promise.all([
      this.prisma.parent.findMany({
        where,
        include: {
          studentParents: {
            include: { student: { select: { id: true, fullName: true } } },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { fullName: 'asc' },
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

  async findOne(id: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, deletedAt: null },
      include: {
        studentParents: {
          include: { student: { select: { id: true, fullName: true, branchId: true } } },
        },
      },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    return this.toResponse(parent);
  }

  async create(input: CreateParentInput, user: AuthUser) {
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
      await this.linkStudent(parent.id, {
        studentId: input.studentId,
        relationshipCode: input.relationshipCode,
      }, user);
    }

    await this.audit.log({
      userId: user.id,
      action: 'parent.created',
      entityType: 'Parent',
      entityId: parent.id,
      newValue: parent,
    });

    return this.findOne(parent.id);
  }

  async linkStudent(parentId: string, input: LinkParentStudentInput, user: AuthUser) {
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

    return this.findOne(parentId);
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

    return { success: true };
  }

  async getStudentParents(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const links = await this.prisma.studentParent.findMany({
      where: { studentId },
      include: { parent: true },
    });

    return {
      studentId,
      parents: links.map((l) => ({
        ...this.toParentSummary(l.parent),
        relationshipCode: l.relationshipCode,
        linkId: l.id,
      })),
    };
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
