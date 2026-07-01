import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
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
  CreateAcademicSessionInput,
  UpdateAcademicSessionInput,
} from '@eims/shared';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListProgramsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const programs = await this.prisma.program.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return { data: programs.map(this.toResponse) };
  }

  async findOne(id: string, branchId: string | null) {
    const program = await this.prisma.program.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    return this.toResponse(program);
  }

  async create(input: CreateProgramInput, user: AuthUser) {
    if (input.code) {
      const existing = await this.prisma.program.findFirst({
        where: { branchId: input.branchId, code: input.code, deletedAt: null },
      });
      if (existing) throw new ConflictException('Program code already exists for this branch');
    }

    const program = await this.prisma.program.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        code: input.code,
        description: input.description,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'program.created',
      entityType: 'Program',
      entityId: program.id,
      newValue: program,
    });

    return this.toResponse(program);
  }

  async update(id: string, input: UpdateProgramInput, branchId: string | null, user: AuthUser) {
    const existing = await this.prisma.program.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Program not found');

    const program = await this.prisma.program.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'program.updated',
      entityType: 'Program',
      entityId: program.id,
      previousValue: existing,
      newValue: program,
    });

    return this.toResponse(program);
  }

  private toResponse(program: {
    id: string;
    branchId: string;
    name: string;
    code: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
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
    };
  }
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListBatchesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const batches = await this.prisma.batch.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      include: { program: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return {
      data: batches.map((b) => ({
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
    };
  }

  async findOne(id: string, branchId: string | null) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

    const batch = await this.prisma.batch.create({
      data: {
        branchId: input.branchId,
        programId: input.programId,
        name: input.name,
        code: input.code,
        sessionId: input.sessionId,
        scheduleType: input.scheduleType,
      },
      include: { program: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'batch.created',
      entityType: 'Batch',
      entityId: batch.id,
      newValue: batch,
    });

    return this.findOne(batch.id, null);
  }

  async update(id: string, input: UpdateBatchInput, branchId: string | null, user: AuthUser) {
    const existing = await this.prisma.batch.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Batch not found');

    const batch = await this.prisma.batch.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.scheduleType !== undefined ? { scheduleType: input.scheduleType } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'batch.updated',
      entityType: 'Batch',
      entityId: batch.id,
      previousValue: existing,
      newValue: batch,
    });

    return this.findOne(batch.id, branchId);
  }
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const subjects = await this.prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return { data: subjects.map(this.toResponse) };
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

  async findAll() {
    const sessions = await this.prisma.academicSession.findMany({
      orderBy: { startDate: 'desc' },
    });
    return { data: sessions.map(this.toResponse) };
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

  async list(batchId: string, branchId: string | null) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

  async set(batchId: string, subjectIds: string[], branchId: string | null, user: AuthUser) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

    return this.list(batchId, branchId);
  }
}
