import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, PaginatedResponse } from '@eims/types';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from '@eims/shared';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: ListStudentsQuery,
    branchId: string | null,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...(query.search
        ? { fullName: { contains: query.search, mode: 'insensitive' as const } }
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
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map((s) => this.toResponse(s)),
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

    const student = await this.prisma.student.create({
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

    await this.audit.log({
      userId: user.id,
      action: 'student.created',
      entityType: 'Student',
      entityId: student.id,
      newValue: student,
    });

    return this.toResponse(student);
  }

  async findOne(id: string, branchId: string | null, includeSubjects = false) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
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

  async update(id: string, input: UpdateStudentInput, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

  async remove(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
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
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }

  async listSubjects(studentId: string, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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
    branchId: string | null,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

    return this.listSubjects(studentId, branchId);
  }
}
