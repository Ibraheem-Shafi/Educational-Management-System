import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { NoticesService } from '../notices/notices.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { selectedBranchScope } from '@eims/shared';
import { ATTENDANCE_ENTITY_STUDENT } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import { getAssignedBatchIds, isAssignedTeacherScope } from '../../common/utils/teacher-assignment.util';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function jsDayToTimetableDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

@Injectable()
export class PortalTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly noticesService: NoticesService,
    private readonly lookupCache: LookupCacheService,
  ) {}

  private assertTeacher(user: AuthUser) {
    if (!user.roles.includes('teacher')) {
      throw new ForbiddenException('Teacher portal access only');
    }
  }

  async getHome(user: AuthUser) {
    this.assertTeacher(user);
    const batchIds = await getAssignedBatchIds(this.prisma, user.id);
    const today = todayIsoDate();
    const dayOfWeek = jsDayToTimetableDay(new Date().getDay());

    const batches = batchIds.length
      ? await this.prisma.batch.findMany({
          where: { id: { in: batchIds }, deletedAt: null },
          select: { id: true, name: true, branchId: true },
        })
      : [];

    const [studentCount, todaySlots, presentId, absentId, lateId] = await Promise.all([
      batchIds.length
        ? this.prisma.student.count({
            where: { batchId: { in: batchIds }, deletedAt: null },
          })
        : Promise.resolve(0),
      this.prisma.timetableSlot.findMany({
        where: { teacherId: user.id, isActive: true, dayOfWeek },
        orderBy: { startTime: 'asc' },
      }),
      this.lookupCache.getStatusId('attendance_status', 'present'),
      this.lookupCache.getStatusId('attendance_status', 'absent'),
      this.lookupCache.getStatusId('attendance_status', 'late'),
    ]);

    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    const studentIds = batchIds.length
      ? (
          await this.prisma.student.findMany({
            where: { batchId: { in: batchIds }, deletedAt: null },
            select: { id: true, batchId: true },
          })
        )
      : [];

    const records = studentIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            entityType: ATTENDANCE_ENTITY_STUDENT,
            entityId: { in: studentIds.map((s) => s.id) },
            date,
          },
          select: { entityId: true, statusId: true },
        })
      : [];

    const recordMap = new Map(records.map((r) => [r.entityId, r.statusId]));
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;
    for (const student of studentIds) {
      const statusId = recordMap.get(student.id);
      if (!statusId) unmarked += 1;
      else if (statusId === presentId) present += 1;
      else if (statusId === absentId) absent += 1;
      else if (statusId === lateId) late += 1;
    }

    const markedByBatch = new Map<string, number>();
    const totalByBatch = new Map<string, number>();
    for (const student of studentIds) {
      totalByBatch.set(student.batchId ?? '', (totalByBatch.get(student.batchId ?? '') ?? 0) + 1);
      if (recordMap.has(student.id)) {
        markedByBatch.set(student.batchId ?? '', (markedByBatch.get(student.batchId ?? '') ?? 0) + 1);
      }
    }

    const unmarkedBatches = batches
      .filter((batch) => (markedByBatch.get(batch.id) ?? 0) < (totalByBatch.get(batch.id) ?? 0))
      .map((batch) => ({
        id: batch.id,
        name: batch.name,
        branchId: batch.branchId,
        marked: markedByBatch.get(batch.id) ?? 0,
        total: totalByBatch.get(batch.id) ?? 0,
      }));

    const total = studentIds.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      stats: {
        students: studentCount,
        classes: batches.length,
        todayAttendance: { present, absent, late, unmarked, total, rate },
      },
      todaySlots: await this.decorateSlots(todaySlots),
      unmarkedBatches,
    };
  }

  private async decorateSlots(
    slots: Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room: string | null;
      batchId: string;
      subjectId: string;
      branchId: string;
    }>,
  ) {
    const batchIds = [...new Set(slots.map((slot) => slot.batchId))];
    const subjectIds = [...new Set(slots.map((slot) => slot.subjectId))];
    const [batches, subjects] = await Promise.all([
      batchIds.length
        ? this.prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: { id: true, name: true, branchId: true },
          })
        : Promise.resolve([]),
      subjectIds.length
        ? this.prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    return slots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      dayName: DAY_NAMES[slot.dayOfWeek] ?? '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      batchId: slot.batchId,
      batchName: batchMap.get(slot.batchId)?.name ?? null,
      branchId: batchMap.get(slot.batchId)?.branchId ?? slot.branchId,
      subjectId: slot.subjectId,
      subjectName: subjectMap.get(slot.subjectId)?.name ?? null,
    }));
  }

  async getBatches(user: AuthUser) {
    this.assertTeacher(user);
    const batchIds = await getAssignedBatchIds(this.prisma, user.id);
    if (batchIds.length === 0) return { data: [] };

    const batches = await this.prisma.batch.findMany({
      where: { id: { in: batchIds }, deletedAt: null },
      select: {
        id: true,
        name: true,
        branchId: true,
        program: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const counts = await this.prisma.student.groupBy({
      by: ['batchId'],
      where: { batchId: { in: batchIds }, deletedAt: null },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.batchId, row._count._all]));

    return {
      data: batches.map((batch) => ({
        id: batch.id,
        name: batch.name,
        branchId: batch.branchId,
        programName: batch.program?.name ?? null,
        programId: batch.program?.id ?? null,
        studentCount: countMap.get(batch.id) ?? 0,
      })),
    };
  }

  async getStudents(user: AuthUser, query: { search?: string; batchId?: string; page?: number; limit?: number }) {
    this.assertTeacher(user);
    const assigned = await getAssignedBatchIds(this.prisma, user.id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (assigned.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }
    if (query.batchId && !assigned.includes(query.batchId)) {
      throw new ForbiddenException('You can only access your assigned classes');
    }

    const where = {
      deletedAt: null,
      batchId: query.batchId ? query.batchId : { in: assigned },
      ...(query.search
        ? { fullName: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fullName: true,
          rollNumber: true,
          admissionNumber: true,
          batchId: true,
          branchId: true,
          batch: { select: { name: true } },
          program: { select: { name: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        batchId: student.batchId,
        branchId: student.branchId,
        batchName: student.batch?.name ?? null,
        programName: student.program?.name ?? null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getParents(user: AuthUser, query: { search?: string; page?: number; limit?: number }) {
    this.assertTeacher(user);
    const assigned = await getAssignedBatchIds(this.prisma, user.id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (assigned.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const students = await this.prisma.student.findMany({
      where: { batchId: { in: assigned }, deletedAt: null },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const where = {
      deletedAt: null,
      studentParents: { some: { studentId: { in: studentIds } } },
      ...(query.search
        ? { fullName: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [parents, total] = await Promise.all([
      this.prisma.parent.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          studentParents: {
            where: { studentId: { in: studentIds } },
            include: { student: { select: { id: true, fullName: true } } },
          },
        },
      }),
      this.prisma.parent.count({ where }),
    ]);

    return {
      data: parents.map((parent) => ({
        id: parent.id,
        fullName: parent.fullName,
        email: parent.email,
        phone: parent.phone,
        children: parent.studentParents.map((link) => ({
          id: link.student.id,
          fullName: link.student.fullName,
          relationshipCode: link.relationshipCode,
        })),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getNotices(user: AuthUser) {
    this.assertTeacher(user);
    const branchIds = user.branchId ? [user.branchId] : [];
    const scope = branchIds.length ? selectedBranchScope(branchIds) : { kind: 'all' as const };
    return this.noticesService.getPortalNotices(user, scope);
  }

  async getTimetable(user: AuthUser) {
    this.assertTeacher(user);
    const slots = await this.prisma.timetableSlot.findMany({
      where: { teacherId: user.id, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const today = jsDayToTimetableDay(new Date().getDay());
    const mapped = await this.decorateSlots(slots);
    return {
      slots: mapped,
      todaySlots: mapped.filter((slot) => slot.dayOfWeek === today),
    };
  }

  isTeacherScoped(user: AuthUser) {
    return isAssignedTeacherScope(user);
  }
}
