import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { computeChangePercent } from '../../common/utils/metrics.util';
import type { AuthUser, PaginatedResponse, StudentsStatsResponse } from '@eims/types';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookupCache: LookupCacheService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(scope: BranchScope): Promise<StudentsStatsResponse> {
    const cacheKey = `students:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<StudentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildStats(scope);
    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  private async buildStats(scope: BranchScope): Promise<StudentsStatsResponse> {
    const branchFilter = prismaBranchFilter(scope);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [activeStatusId, inactiveStatusId] = await Promise.all([
      this.lookupCache.getStatusId('student_status', 'active'),
      this.lookupCache.getStatusId('student_status', 'inactive'),
    ]);

    const baseStudent = { ...branchFilter, deletedAt: null };
    const previousStudent = { ...baseStudent, createdAt: { lte: thirtyDaysAgo } };
    const baseBatch = { ...branchFilter, deletedAt: null };
    const previousBatch = { ...baseBatch, createdAt: { lte: thirtyDaysAgo } };

    const [
      totalStudents,
      totalStudentsPrevious,
      activeStudents,
      activeStudentsPrevious,
      inactiveStudents,
      inactiveStudentsPrevious,
      totalBatches,
      totalBatchesPrevious,
    ] = await Promise.all([
      this.prisma.student.count({ where: baseStudent }),
      this.prisma.student.count({ where: previousStudent }),
      activeStatusId
        ? this.prisma.student.count({ where: { ...baseStudent, statusId: activeStatusId } })
        : Promise.resolve(0),
      activeStatusId
        ? this.prisma.student.count({
            where: { ...previousStudent, statusId: activeStatusId },
          })
        : Promise.resolve(0),
      inactiveStatusId
        ? this.prisma.student.count({ where: { ...baseStudent, statusId: inactiveStatusId } })
        : Promise.resolve(0),
      inactiveStatusId
        ? this.prisma.student.count({
            where: { ...previousStudent, statusId: inactiveStatusId },
          })
        : Promise.resolve(0),
      this.prisma.batch.count({ where: baseBatch }),
      this.prisma.batch.count({ where: previousBatch }),
    ]);

    return {
      totalStudents: {
        total: totalStudents,
        changePercent: computeChangePercent(totalStudents, totalStudentsPrevious),
      },
      activeStudents: {
        total: activeStudents,
        changePercent: computeChangePercent(activeStudents, activeStudentsPrevious),
      },
      inactiveStudents: {
        total: inactiveStudents,
        changePercent: computeChangePercent(inactiveStudents, inactiveStudentsPrevious),
      },
      totalBatches: {
        total: totalBatches,
        changePercent: computeChangePercent(totalBatches, totalBatchesPrevious),
      },
    };
  }

  async findAll(
    query: ListStudentsQuery,
    scope: BranchScope,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(scope),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              // Student IDs render as STD-<last6 of id>; strip the prefix so
              // searching by the visible student ID matches the underlying id.
              { id: { contains: query.search.replace(/^STD-/i, ''), mode: 'insensitive' as const } },
              { cnicOrBForm: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        select: {
          id: true,
          branchId: true,
          fullName: true,
          dateOfBirth: true,
          gender: true,
          cnicOrBForm: true,
          phone: true,
          email: true,
          address: true,
          photographUrl: true,
          programId: true,
          batchId: true,
          statusId: true,
          customFields: true,
          createdAt: true,
          updatedAt: true,
          batch: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.student.count({ where }),
    ]);

    const statusIds = [...new Set(data.map((s) => s.statusId))];
    const statusRows = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statusRows.map((s) => [s.id, s]));

    return {
      data: data.map((s) =>
        this.toResponse({
          ...s,
          status: statusMap.get(s.statusId) ?? null,
        }),
      ),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(input: CreateStudentInput, user: AuthUser) {
    if (input.batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: input.batchId, branchId: input.branchId, deletedAt: null },
      });
      if (!batch) throw new BadRequestException('Invalid batch for this branch');
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          branchId: input.branchId,
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          gender: input.gender,
          cnicOrBForm: input.cnicOrBForm,
          phone: input.phone,
          email: input.email,
          address: input.address,
          programId: input.programId,
          batchId: input.batchId,
          statusId: input.statusId,
          customFields: input.customFields ?? {},
          createdById: user.id,
        },
        include: { batch: true, program: true },
      });

      if (input.guardians?.length) {
        for (const guardian of input.guardians) {
          const parent = await tx.parent.create({
            data: {
              fullName: guardian.fullName,
              phone: guardian.phone,
              email: guardian.email,
              address: guardian.address,
              cnic: guardian.cnic,
            },
          });

          await tx.studentParent.create({
            data: {
              studentId: created.id,
              parentId: parent.id,
              relationshipCode: guardian.relationshipCode,
            },
          });
        }
      }

      return created;
    });

    await this.audit.log({
      userId: user.id,
      action: 'student.created',
      entityType: 'Student',
      entityId: student.id,
      newValue: student,
    });

    return this.toResponse(student);
  }

  async findOne(id: string, scope: BranchScope, includeSubjects = false) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
        ...prismaBranchFilter(scope),
      },
      select: {
        id: true,
        branchId: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        cnicOrBForm: true,
        phone: true,
        email: true,
        address: true,
        photographUrl: true,
        programId: true,
        batchId: true,
        statusId: true,
        customFields: true,
        createdAt: true,
        updatedAt: true,
        batch: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const response = this.toResponse(student);
    if (!includeSubjects) return response;

    const links = await this.prisma.studentSubject.findMany({
      where: { studentId: id },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    return {
      ...response,
      subjects: links.map((l) => ({
        id: l.subject.id,
        name: l.subject.name,
        code: l.subject.code,
      })),
    };
  }

  async update(id: string, input: UpdateStudentInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Student not found');

    if (input.batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: input.batchId, branchId: existing.branchId, deletedAt: null },
      });
      if (!batch) throw new BadRequestException('Invalid batch for this branch');
    }

    const student = await this.prisma.student.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.dateOfBirth !== undefined
          ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }
          : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.cnicOrBForm !== undefined ? { cnicOrBForm: input.cnicOrBForm } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.photographUrl !== undefined ? { photographUrl: input.photographUrl } : {}),
        ...(input.programId !== undefined ? { programId: input.programId } : {}),
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
        ...(input.customFields !== undefined ? { customFields: input.customFields } : {}),
      },
      include: { batch: true, program: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'student.updated',
      entityType: 'Student',
      entityId: student.id,
      previousValue: existing,
      newValue: student,
    });

    return this.toResponse(student);
  }

  async remove(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Student not found');

    const student = await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'student.deleted',
      entityType: 'Student',
      entityId: id,
      previousValue: existing,
      newValue: student,
    });

    return { success: true };
  }

  private toResponse(student: {
    id: string;
    branchId: string;
    fullName: string;
    dateOfBirth: Date | null;
    gender: string | null;
    cnicOrBForm: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photographUrl: string | null;
    programId: string | null;
    batchId: string | null;
    statusId: string;
    customFields?: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    batch?: { id: string; name: string } | null;
    program?: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
    status?: { id: string; code: string; label: string } | null;
  }) {
    return {
      id: student.id,
      branchId: student.branchId,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
      gender: student.gender,
      cnicOrBForm: student.cnicOrBForm,
      phone: student.phone,
      email: student.email,
      address: student.address,
      photographUrl: student.photographUrl,
      programId: student.programId,
      batchId: student.batchId,
      statusId: student.statusId,
      customFields:
        student.customFields && typeof student.customFields === 'object' && !Array.isArray(student.customFields)
          ? (student.customFields as Record<string, unknown>)
          : {},
      batch: student.batch ? { id: student.batch.id, name: student.batch.name } : undefined,
      program: student.program ? { id: student.program.id, name: student.program.name } : undefined,
      branch: student.branch ? { id: student.branch.id, name: student.branch.name } : undefined,
      status: student.status
        ? { id: student.status.id, code: student.status.code, label: student.status.label }
        : undefined,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }

  async listSubjects(studentId: string, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const links = await this.prisma.studentSubject.findMany({
      where: { studentId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });

    return {
      studentId,
      subjects: links.map((l) => ({
        id: l.subject.id,
        name: l.subject.name,
        code: l.subject.code,
      })),
    };
  }

  async setSubjects(
    studentId: string,
    subjectIds: string[],
    user: AuthUser,
    scope: BranchScope,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, deletedAt: null },
    });
    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException('One or more subjects are invalid');
    }

    await this.prisma.$transaction([
      this.prisma.studentSubject.deleteMany({ where: { studentId } }),
      ...subjectIds.map((subjectId) =>
        this.prisma.studentSubject.create({ data: { studentId, subjectId } }),
      ),
    ]);

    await this.audit.log({
      userId: user.id,
      action: 'student_subjects.updated',
      entityType: 'Student',
      entityId: studentId,
      newValue: { subjectIds },
    });

    return this.listSubjects(studentId, scope);
  }
}
