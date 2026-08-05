import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { allBranchScope, selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { paginatedResult } from '../../common/utils/pagination.util';
import type { AuthUser } from '@eims/types';
import type {
  CreateProgramInput,
  UpdateProgramInput,
  ListProgramsQuery,
  CreateBatchInput,
  UpdateBatchInput,
  ListBatchesQuery,
  CreateSubjectInput,
  UpdateSubjectInput,
  ListSubjectsQuery,
  CreateAcademicSessionInput,
  UpdateAcademicSessionInput,
  ListAcademicSessionsQuery,
  ProgramBatchInput,
} from '@eims/shared';

async function assertValidSubjectIds(
  prisma: PrismaService,
  subjectIds: string[] | undefined,
) {
  if (!subjectIds?.length) return;
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, deletedAt: null },
    select: { id: true },
  });
  if (subjects.length !== subjectIds.length) {
    throw new BadRequestException('One or more subjects are invalid');
  }
}

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lightweight catalog for staff dropdowns (no academic.read required). */
  async listOptions(
    scope: BranchScope,
    query: { branchId?: string } = {},
  ) {
    const effective = narrowScope(scope, query.branchId);
    const programs = await this.prisma.program.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...prismaBranchFilter(effective),
      },
      select: { id: true, name: true, branchId: true },
      orderBy: { name: 'asc' },
    });
    return { data: programs };
  }

  async findAll(query: ListProgramsQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(effective),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [programs, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        include: {
          batches: {
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.program.count({ where }),
    ]);
    return paginatedResult(programs.map((p) => this.toListResponse(p)), total, page, limit);
  }

  async findOne(id: string, scope: BranchScope) {
    const program = await this.prisma.program.findFirst({
      where: {
        id,
        deletedAt: null,
        ...prismaBranchFilter(scope),
      },
      include: {
        batches: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          include: {
            batchSubjects: {
              include: { subject: { select: { id: true, name: true, code: true } } },
              orderBy: { subject: { name: 'asc' } },
            },
          },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    return this.toDetailResponse(program);
  }

  async create(input: CreateProgramInput, user: AuthUser) {
    if (input.code) {
      const existing = await this.prisma.program.findFirst({
        where: { branchId: input.branchId, code: input.code, deletedAt: null },
      });
      if (existing) throw new ConflictException('Program code already exists for this branch');
    }

    for (const batch of input.batches ?? []) {
      await assertValidSubjectIds(this.prisma, batch.subjectIds);
    }

    const programId = await this.prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: {
          branchId: input.branchId,
          name: input.name,
          code: input.code,
          description: input.description,
        },
      });

      for (const batchInput of input.batches ?? []) {
        const batch = await tx.batch.create({
          data: {
            branchId: input.branchId,
            programId: program.id,
            name: batchInput.name,
          },
        });
        if (batchInput.subjectIds?.length) {
          await tx.batchSubject.createMany({
            data: batchInput.subjectIds.map((subjectId) => ({
              batchId: batch.id,
              subjectId,
            })),
          });
        }
      }

      return program.id;
    });

    await this.audit.log({
      userId: user.id,
      action: 'program.created',
      entityType: 'Program',
      entityId: programId,
      newValue: { ...input, id: programId },
    });

    return this.findOne(programId, allBranchScope());
  }

  async update(id: string, input: UpdateProgramInput, scope: BranchScope, user: AuthUser) {
    const existing = await this.prisma.program.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Program not found');

    for (const batch of input.batches ?? []) {
      await assertValidSubjectIds(this.prisma, batch.subjectIds);
      if (batch.id) {
        const owned = await this.prisma.batch.findFirst({
          where: { id: batch.id, programId: id, deletedAt: null },
        });
        if (!owned) throw new BadRequestException('One or more batches do not belong to this program');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.program.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      if (input.batches) {
        await this.syncProgramBatches(tx, id, existing.branchId, input.batches);
      }
    });

    await this.audit.log({
      userId: user.id,
      action: 'program.updated',
      entityType: 'Program',
      entityId: id,
      previousValue: existing,
      newValue: input,
    });

    return this.findOne(id, scope);
  }

  private async syncProgramBatches(
    tx: Prisma.TransactionClient,
    programId: string,
    branchId: string,
    batches: ProgramBatchInput[],
  ) {
    for (const batchInput of batches) {
      let batchId = batchInput.id;
      if (batchId) {
        await tx.batch.update({
          where: { id: batchId },
          data: { name: batchInput.name },
        });
      } else {
        const created = await tx.batch.create({
          data: {
            branchId,
            programId,
            name: batchInput.name,
          },
        });
        batchId = created.id;
      }

      if (batchInput.subjectIds !== undefined) {
        await tx.batchSubject.deleteMany({ where: { batchId } });
        if (batchInput.subjectIds.length) {
          await tx.batchSubject.createMany({
            data: batchInput.subjectIds.map((subjectId) => ({
              batchId,
              subjectId,
            })),
          });
        }
      }
    }
  }

  private toListResponse(program: {
    id: string;
    branchId: string;
    name: string;
    code: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    batches: Array<{ id: string; name: string }>;
  }) {
    return {
      id: program.id,
      branchId: program.branchId,
      name: program.name,
      code: program.code,
      description: program.description,
      isActive: program.isActive,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
      batches: program.batches,
    };
  }

  private toDetailResponse(program: {
    id: string;
    branchId: string;
    name: string;
    code: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    batches: Array<{
      id: string;
      name: string;
      batchSubjects: Array<{
        subject: { id: string; name: string; code: string | null };
      }>;
    }>;
  }) {
    return {
      id: program.id,
      branchId: program.branchId,
      name: program.name,
      code: program.code,
      description: program.description,
      isActive: program.isActive,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
      batches: program.batches.map((b) => ({
        id: b.id,
        name: b.name,
        subjects: b.batchSubjects.map((link) => ({
          id: link.subject.id,
          name: link.subject.name,
          code: link.subject.code,
        })),
      })),
    };
  }
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lightweight catalog for staff dropdowns (no academic.read required). */
  async listOptions(
    scope: BranchScope,
    query: { branchId?: string; programId?: string } = {},
  ) {
    const effective = narrowScope(scope, query.branchId);
    const batches = await this.prisma.batch.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...prismaBranchFilter(effective),
        ...(query.programId ? { programId: query.programId } : {}),
      },
      select: { id: true, name: true, branchId: true, programId: true },
      orderBy: { name: 'asc' },
    });
    return { data: batches };
  }

  async findAll(query: ListBatchesQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(effective),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [batches, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        include: { program: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.batch.count({ where }),
    ]);
    return paginatedResult(
      batches.map((b) => ({
        id: b.id,
        branchId: b.branchId,
        programId: b.programId,
        program: b.program,
        name: b.name,
        code: b.code,
        sessionId: b.sessionId,
        scheduleType: b.scheduleType,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, scope: BranchScope) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { program: { select: { id: true, name: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return {
      id: batch.id,
      branchId: batch.branchId,
      programId: batch.programId,
      program: batch.program,
      name: batch.name,
      code: batch.code,
      sessionId: batch.sessionId,
      scheduleType: batch.scheduleType,
      isActive: batch.isActive,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }

  async create(input: CreateBatchInput, user: AuthUser) {
    const program = await this.prisma.program.findFirst({
      where: { id: input.programId, branchId: input.branchId, deletedAt: null },
    });
    if (!program) throw new BadRequestException('Invalid program for this branch');

    await assertValidSubjectIds(this.prisma, input.subjectIds);

    const batchId = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          branchId: input.branchId,
          programId: input.programId,
          name: input.name,
          code: input.code,
          sessionId: input.sessionId,
          scheduleType: input.scheduleType,
        },
      });
      if (input.subjectIds?.length) {
        await tx.batchSubject.createMany({
          data: input.subjectIds.map((subjectId) => ({
            batchId: batch.id,
            subjectId,
          })),
        });
      }
      return batch.id;
    });

    await this.audit.log({
      userId: user.id,
      action: 'batch.created',
      entityType: 'Batch',
      entityId: batchId,
      newValue: input,
    });

    return this.findOne(batchId, allBranchScope());
  }

  async update(id: string, input: UpdateBatchInput, scope: BranchScope, user: AuthUser) {
    const existing = await this.prisma.batch.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Batch not found');

    await assertValidSubjectIds(this.prisma, input.subjectIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.batch.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
          ...(input.scheduleType !== undefined ? { scheduleType: input.scheduleType } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      if (input.subjectIds !== undefined) {
        await tx.batchSubject.deleteMany({ where: { batchId: id } });
        if (input.subjectIds.length) {
          await tx.batchSubject.createMany({
            data: input.subjectIds.map((subjectId) => ({
              batchId: id,
              subjectId,
            })),
          });
        }
      }
    });

    await this.audit.log({
      userId: user.id,
      action: 'batch.updated',
      entityType: 'Batch',
      entityId: id,
      previousValue: existing,
      newValue: input,
    });

    return this.findOne(id, scope);
  }
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lightweight catalog for staff dropdowns — no academic.read required. */
  async listOptions(query: { q?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 200);
    const q = query.q?.trim();

    const subjects = await this.prisma.subject.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return { data: subjects };
  }

  async findAll(query: ListSubjectsQuery) {
    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { code: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [subjects, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subject.count({ where }),
    ]);
    return paginatedResult(subjects.map(this.toResponse), total, page, limit);
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.toResponse(subject);
  }

  async create(input: CreateSubjectInput, user: AuthUser) {
    if (input.code) {
      const existing = await this.prisma.subject.findFirst({
        where: { code: input.code, deletedAt: null },
      });
      if (existing) throw new ConflictException('Subject code already exists');
    }

    const subject = await this.prisma.subject.create({
      data: { name: input.name, code: input.code },
    });

    await this.audit.log({
      userId: user.id,
      action: 'subject.created',
      entityType: 'Subject',
      entityId: subject.id,
      newValue: subject,
    });

    return this.toResponse(subject);
  }

  async update(id: string, input: UpdateSubjectInput, user: AuthUser) {
    const existing = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Subject not found');

    const subject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'subject.updated',
      entityType: 'Subject',
      entityId: subject.id,
      previousValue: existing,
      newValue: subject,
    });

    return this.toResponse(subject);
  }

  private toResponse(subject: {
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      isActive: subject.isActive,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class AcademicSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListAcademicSessionsQuery) {
    const where = {
      ...(query.isCurrent !== undefined ? { isCurrent: query.isCurrent } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [sessions, total] = await Promise.all([
      this.prisma.academicSession.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.academicSession.count({ where }),
    ]);
    return paginatedResult(sessions.map(this.toResponse), total, page, limit);
  }

  async findOne(id: string) {
    const session = await this.prisma.academicSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Academic session not found');
    return this.toResponse(session);
  }

  async create(input: CreateAcademicSessionInput, user: AuthUser) {
    if (input.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const session = await this.prisma.academicSession.create({
      data: {
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        isCurrent: input.isCurrent ?? false,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'academic_session.created',
      entityType: 'AcademicSession',
      entityId: session.id,
      newValue: session,
    });

    return this.toResponse(session);
  }

  async update(id: string, input: UpdateAcademicSessionInput, user: AuthUser) {
    const existing = await this.prisma.academicSession.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Academic session not found');

    if (input.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { isCurrent: true, NOT: { id } },
        data: { isCurrent: false },
      });
    }

    const session = await this.prisma.academicSession.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
        ...(input.isCurrent !== undefined ? { isCurrent: input.isCurrent } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'academic_session.updated',
      entityType: 'AcademicSession',
      entityId: session.id,
      previousValue: existing,
      newValue: session,
    });

    return this.toResponse(session);
  }

  private toResponse(session: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: session.id,
      name: session.name,
      startDate: session.startDate.toISOString(),
      endDate: session.endDate.toISOString(),
      isCurrent: session.isCurrent,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class BatchSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(batchId: string, scope: BranchScope) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const links = await this.prisma.batchSubject.findMany({
      where: { batchId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });

    return {
      batchId,
      subjects: links.map((l) => ({
        id: l.subject.id,
        name: l.subject.name,
        code: l.subject.code,
      })),
    };
  }

  async set(batchId: string, subjectIds: string[], scope: BranchScope, user: AuthUser) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, deletedAt: null },
    });
    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException('One or more subjects are invalid');
    }

    await this.prisma.$transaction([
      this.prisma.batchSubject.deleteMany({ where: { batchId } }),
      ...subjectIds.map((subjectId) =>
        this.prisma.batchSubject.create({ data: { batchId, subjectId } }),
      ),
    ]);

    await this.audit.log({
      userId: user.id,
      action: 'batch_subjects.updated',
      entityType: 'Batch',
      entityId: batchId,
      newValue: { subjectIds },
    });

    return this.list(batchId, scope);
  }
}
