import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type {
  AttendanceSheetQuery,
  BulkAttendanceInput,
  AttendanceHistoryQuery,
  StaffAttendanceSheetQuery,
  BulkStaffAttendanceInput,
} from '@eims/shared';
import { ATTENDANCE_ENTITY_STUDENT } from '@eims/shared';

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSheet(query: AttendanceSheetQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('branchId is required');
    }

    const date = parseDateOnly(query.date);

    const [batch, students] = await Promise.all([
      this.prisma.batch.findFirst({
        where: {
          id: query.batchId,
          branchId: effectiveBranchId,
          deletedAt: null,
        },
      }),
      this.prisma.student.findMany({
        where: {
          branchId: effectiveBranchId,
          batchId: query.batchId,
          deletedAt: null,
        },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true },
      }),
    ]);
    if (!batch) throw new NotFoundException('Batch not found');

    const studentIds = students.map((s) => s.id);
    const records = studentIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            entityType: ATTENDANCE_ENTITY_STUDENT,
            entityId: { in: studentIds },
            date,
            branchId: effectiveBranchId,
          },
          select: {
            id: true,
            entityId: true,
            statusId: true,
            remarks: true,
            updatedAt: true,
          },
        })
      : [];

    const recordMap = new Map(records.map((r) => [r.entityId, r]));

    const statusIds = [...new Set(records.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    return {
      date: query.date,
      branchId: effectiveBranchId,
      batchId: query.batchId,
      batchName: batch.name,
      students: students.map((student) => {
        const record = recordMap.get(student.id);
        const status = record ? statusMap.get(record.statusId) : null;
        return {
          studentId: student.id,
          fullName: student.fullName,
          attendance: record
            ? {
                id: record.id,
                statusId: record.statusId,
                status,
                remarks: record.remarks,
                markedAt: record.updatedAt.toISOString(),
              }
            : null,
        };
      }),
      summary: {
        total: students.length,
        marked: records.length,
        unmarked: students.length - records.length,
      },
    };
  }

  async bulkMark(input: BulkAttendanceInput, user: AuthUser) {
    const date = parseDateOnly(input.date);

    const studentIds = input.records.map((r) => r.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        branchId: input.branchId,
        deletedAt: null,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      select: { id: true },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException('One or more students are invalid for this branch/batch');
    }

    const statusIds = [...new Set(input.records.map((r) => r.statusId))];
    const validStatuses = await this.prisma.lookupStatus.findMany({
      where: {
        id: { in: statusIds },
        category: { code: 'attendance_status' },
        isActive: true,
      },
    });
    if (validStatuses.length !== statusIds.length) {
      throw new BadRequestException('Invalid attendance status');
    }

    const results = await this.prisma.$transaction(
      input.records.map((record) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            entityType_entityId_date: {
              entityType: ATTENDANCE_ENTITY_STUDENT,
              entityId: record.studentId,
              date,
            },
          },
          create: {
            branchId: input.branchId,
            entityType: ATTENDANCE_ENTITY_STUDENT,
            entityId: record.studentId,
            date,
            statusId: record.statusId,
            remarks: record.remarks,
            markedById: user.id,
          },
          update: {
            statusId: record.statusId,
            remarks: record.remarks,
            markedById: user.id,
          },
        }),
      ),
    );

    await this.audit.log({
      userId: user.id,
      action: 'attendance.bulk_marked',
      entityType: 'AttendanceRecord',
      newValue: {
        branchId: input.branchId,
        date: input.date,
        batchId: input.batchId,
        count: results.length,
      },
    });

    return {
      date: input.date,
      branchId: input.branchId,
      batchId: input.batchId,
      marked: results.length,
    };
  }

  async getHistory(query: AttendanceHistoryQuery, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: query.studentId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const from = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        entityType: ATTENDANCE_ENTITY_STUDENT,
        entityId: query.studentId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'desc' },
    });

    const statusIds = [...new Set(records.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    return {
      studentId: query.studentId,
      studentName: student.fullName,
      from: query.from,
      to: query.to,
      records: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        statusId: r.statusId,
        status: statusMap.get(r.statusId) ?? null,
        remarks: r.remarks,
        markedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async getStaffSheet(query: StaffAttendanceSheetQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    if (!effectiveBranchId) throw new BadRequestException('branchId is required');

    const roleCodes =
      query.entityType === 'teacher'
        ? ['teacher']
        : ['accountant', 'receptionist', 'branch_admin'];
    const users = await this.prisma.user.findMany({
      where: {
        branchId: effectiveBranchId,
        deletedAt: null,
        isActive: true,
        userRoles: { some: { role: { code: { in: roleCodes } } } },
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    });

    const date = parseDateOnly(query.date);
    const userIds = users.map((u) => u.id);
    const records = userIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            entityType: query.entityType,
            entityId: { in: userIds },
            date,
            branchId: effectiveBranchId,
          },
        })
      : [];

    const recordMap = new Map(records.map((r) => [r.entityId, r]));
    const statusIds = [...new Set(records.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    return {
      date: query.date,
      branchId: effectiveBranchId,
      entityType: query.entityType,
      members: users.map((member) => {
        const record = recordMap.get(member.id);
        return {
          userId: member.id,
          fullName: member.fullName,
          attendance: record
            ? {
                id: record.id,
                statusId: record.statusId,
                status: statusMap.get(record.statusId) ?? null,
                remarks: record.remarks,
              }
            : null,
        };
      }),
      summary: { total: users.length, marked: records.length },
    };
  }

  async bulkMarkStaff(input: BulkStaffAttendanceInput, user: AuthUser) {
    const date = parseDateOnly(input.date);
    const userIds = input.records.map((r) => r.userId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, branchId: input.branchId, deletedAt: null },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users are invalid for this branch');
    }

    const statusIds = [...new Set(input.records.map((r) => r.statusId))];
    const validStatuses = await this.prisma.lookupStatus.findMany({
      where: {
        id: { in: statusIds },
        category: { code: 'attendance_status' },
        isActive: true,
      },
    });
    if (validStatuses.length !== statusIds.length) {
      throw new BadRequestException('Invalid attendance status');
    }

    const results = await this.prisma.$transaction(
      input.records.map((record) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            entityType_entityId_date: {
              entityType: input.entityType,
              entityId: record.userId,
              date,
            },
          },
          create: {
            branchId: input.branchId,
            entityType: input.entityType,
            entityId: record.userId,
            date,
            statusId: record.statusId,
            remarks: record.remarks,
            markedById: user.id,
          },
          update: {
            statusId: record.statusId,
            remarks: record.remarks,
            markedById: user.id,
          },
        }),
      ),
    );

    await this.audit.log({
      userId: user.id,
      action: 'attendance.staff_bulk_marked',
      entityType: 'AttendanceRecord',
      newValue: { branchId: input.branchId, date: input.date, entityType: input.entityType, count: results.length },
    });

    return { date: input.date, branchId: input.branchId, entityType: input.entityType, marked: results.length };
  }
}
