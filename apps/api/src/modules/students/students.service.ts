import { narrowScope, prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { computeChangePercent } from '../../common/utils/metrics.util';
import type { AuthUser, PaginatedResponse, StudentsStatsResponse } from '@eims/types';
import type {
  CreateStudentInput,
  ListStudentsQuery,
  PrepareStudentPhotoUploadInput,
  UpdateStudentInput,
} from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;
const OPTIONS_LIMIT_MAX = 200;
const PHOTOS_BUCKET = 'student-photos';

export type StudentOptionsQuery = {
  branchId?: string;
  batchId?: string;
  q?: string;
  limit?: number;
};

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookupCache: LookupCacheService,
    private readonly ttlCache: TtlCacheService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabaseAdmin = createClient(url, key);
    }
  }

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

  /** Lightweight catalog for staff dropdowns (no students.read required). */
  async listOptions(query: StudentOptionsQuery, scope: BranchScope) {
    const effective = narrowScope(scope, query.branchId);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), OPTIONS_LIMIT_MAX);
    const q = query.q?.trim();

    const activeStatusId = await this.lookupCache.getStatusId('student_status', 'active');
    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...prismaBranchFilter(effective),
        ...(activeStatusId ? { statusId: activeStatusId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' as const } },
                { rollNumber: { contains: q, mode: 'insensitive' as const } },
                { admissionNumber: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, fullName: true, rollNumber: true, batchId: true },
      orderBy: { fullName: 'asc' },
      take: limit,
    });

    return { data: students };
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
              { id: { contains: query.search.replace(/^STD-/i, ''), mode: 'insensitive' as const } },
              { cnicOrBForm: { contains: query.search, mode: 'insensitive' as const } },
              { rollNumber: { contains: query.search, mode: 'insensitive' as const } },
              { admissionNumber: { contains: query.search, mode: 'insensitive' as const } },
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
          admissionNumber: true,
          rollNumber: true,
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
          admissionNumber: input.admissionNumber ?? null,
          rollNumber: input.rollNumber ?? null,
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
        admissionNumber: true,
        rollNumber: true,
        customFields: true,
        createdAt: true,
        updatedAt: true,
        batch: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
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

  async preparePhotoUpload(
    id: string,
    input: PrepareStudentPhotoUploadInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const canUpload =
      user.permissions.includes('students.update') || user.permissions.includes('students.create');
    if (!canUpload) throw new ForbiddenException('Insufficient permissions');

    const student = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      select: { id: true, branchId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (!this.supabaseAdmin) {
      throw new BadRequestException(
        'File uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    await this.ensurePhotosBucket();

    const safeName =
      input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || 'photo';
    const path = `${student.branchId}/${student.id}/${Date.now()}-${safeName.slice(0, 120)}`;
    const { data, error } = await this.supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Could not prepare photo upload');
    }

    return {
      bucket: PHOTOS_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  private async ensurePhotosBucket(): Promise<void> {
    if (!this.supabaseAdmin) return;
    try {
      const { data } = await this.supabaseAdmin.storage.getBucket(PHOTOS_BUCKET);
      if (!data) {
        await this.supabaseAdmin.storage.createBucket(PHOTOS_BUCKET, { public: true });
        this.logger.log(`Created storage bucket "${PHOTOS_BUCKET}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not verify/create storage bucket "${PHOTOS_BUCKET}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
        ...(input.admissionNumber !== undefined ? { admissionNumber: input.admissionNumber } : {}),
        ...(input.rollNumber !== undefined ? { rollNumber: input.rollNumber } : {}),
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
    admissionNumber?: string | null;
    rollNumber?: string | null;
    customFields?: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    batch?: { id: string; name: string } | null;
    program?: { id: string; name: string } | null;
    branch?: { id: string; name: string; code?: string } | null;
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
      admissionNumber: student.admissionNumber ?? null,
      rollNumber: student.rollNumber ?? null,
      customFields:
        student.customFields && typeof student.customFields === 'object' && !Array.isArray(student.customFields)
          ? (student.customFields as Record<string, unknown>)
          : {},
      batch: student.batch ? { id: student.batch.id, name: student.batch.name } : undefined,
      program: student.program ? { id: student.program.id, name: student.program.name } : undefined,
      branch: student.branch
        ? { id: student.branch.id, name: student.branch.name, code: student.branch.code }
        : undefined,
      status: student.status
        ? { id: student.status.id, code: student.status.code, label: student.status.label }
        : undefined,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }

  async generateRollNumbers(
    input: import('@eims/shared').GenerateRollNumbersInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const students = await this.prisma.student.findMany({
      where: {
        batchId: input.batchId,
        deletedAt: null,
        ...prismaBranchFilter(scope),
        ...(input.overwriteExisting ? {} : { rollNumber: null }),
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, rollNumber: true },
    });

    let next = input.startFrom;
    let updated = 0;
    for (const student of students) {
      if (!input.overwriteExisting && student.rollNumber) continue;
      const rollNumber = `${input.prefix ?? ''}${String(next).padStart(input.padLength, '0')}`;
      await this.prisma.student.update({
        where: { id: student.id },
        data: { rollNumber },
      });
      next += 1;
      updated += 1;
    }

    await this.audit.log({
      userId: user.id,
      action: 'student.roll_numbers_generated',
      entityType: 'Batch',
      entityId: input.batchId,
      newValue: { updated, startFrom: input.startFrom },
    });

    return { updated, batchId: input.batchId };
  }

  async getRollSlipPrintData(id: string, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      select: {
        id: true,
        fullName: true,
        rollNumber: true,
        admissionNumber: true,
        photographUrl: true,
        cnicOrBForm: true,
        phone: true,
        program: { select: { name: true } },
        batch: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        branchId: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [settings, template] = await Promise.all([
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'roll_slip',
          isActive: true,
          OR: [{ branchId: student.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);

    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS.roll_slip;
    const stored =
      template?.fields && typeof template.fields === 'object' && !Array.isArray(template.fields)
        ? (template.fields as Record<string, boolean>)
        : {};

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        photographUrl: student.photographUrl,
        cnicOrBForm: student.cnicOrBForm,
        phone: student.phone,
        program: student.program?.name ?? null,
        batch: student.batch?.name ?? null,
        branch: student.branch,
      },
      institution: {
        name: settings?.name ?? 'Institution',
        logoUrl: settings?.logoUrl ?? null,
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
      },
      template: {
        id: template?.id ?? null,
        type: 'roll_slip',
        name: template?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES.roll_slip,
        paperSize: template?.paperSize ?? 'a4',
        fields: { ...defaults, ...stored },
        headerText: template?.headerText ?? null,
        footerText: template?.footerText ?? null,
        extraNote: template?.extraNote ?? null,
      },
    };
  }

  async getRosterPrintData(batchId: string, scope: BranchScope) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null, ...prismaBranchFilter(scope) },
      include: {
        program: { select: { name: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const students = await this.prisma.student.findMany({
      where: { batchId, deletedAt: null, ...prismaBranchFilter(scope) },
      orderBy: [{ rollNumber: 'asc' }, { fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        rollNumber: true,
        admissionNumber: true,
        phone: true,
        statusId: true,
      },
    });

    const statusIds = [...new Set(students.map((s) => s.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({ where: { id: { in: statusIds } } })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    const [settings, template, branch] = await Promise.all([
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'student_roster',
          isActive: true,
          OR: [{ branchId: batch.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
      this.prisma.branch.findUnique({
        where: { id: batch.branchId },
        select: { name: true, code: true },
      }),
    ]);

    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS.student_roster;
    const stored =
      template?.fields && typeof template.fields === 'object' && !Array.isArray(template.fields)
        ? (template.fields as Record<string, boolean>)
        : {};

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        program: batch.program?.name ?? null,
        branch: branch,
      },
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        rollNumber: s.rollNumber,
        admissionNumber: s.admissionNumber,
        phone: s.phone,
        status: statusMap.get(s.statusId)?.label ?? null,
      })),
      institution: {
        name: settings?.name ?? 'Institution',
        logoUrl: settings?.logoUrl ?? null,
        address: settings?.address ?? null,
      },
      template: {
        paperSize: template?.paperSize ?? 'a4',
        fields: { ...defaults, ...stored },
        headerText: template?.headerText ?? null,
        footerText: template?.footerText ?? null,
        name: template?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES.student_roster,
      },
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
