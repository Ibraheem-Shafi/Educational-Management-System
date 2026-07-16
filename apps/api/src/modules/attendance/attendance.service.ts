import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { countWithTrend, thirtyDaysAgo, todayStart } from '../../common/utils/stats.util';
import type { AttendanceStatsResponse, AttendanceTrendResponse, AuthUser } from '@eims/types';
import type {
  AttendanceSheetQuery,
  BulkAttendanceInput,
  AttendanceHistoryQuery,
  AttendanceGridQuery,
  StaffAttendanceSheetQuery,
  BulkStaffAttendanceInput,
} from '@eims/shared';
import { ATTENDANCE_ENTITY_STUDENT } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function monthDateRange(month: string): { from: Date; to: Date; dates: string[] } {
  const [year, monthNum] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, monthNum - 1, 1));
  const to = new Date(Date.UTC(year, monthNum, 0));
  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { from, to, dates };
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
    private readonly lookupCache: LookupCacheService,
  ) {}

  async getStats(branchId: string | null): Promise<AttendanceStatsResponse> {
    const cacheKey = `attendance:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<AttendanceStatsResponse>(cacheKey);
    if (cached) return cached;

    const today = todayStart();
    const thirtyAgo = thirtyDaysAgo();
    const branchFilter = branchId ? { branchId } : {};
    const studentFilter = { entityType: ATTENDANCE_ENTITY_STUDENT, ...branchFilter };

    const [presentId, absentId] = await Promise.all([
      this.lookupCache.getStatusId('attendance_status', 'present'),
      this.lookupCache.getStatusId('attendance_status', 'absent'),
    ]);

    const todayWhere = { ...studentFilter, date: today };
    const monthStart = new Date(today);
    monthStart.setUTCDate(1);

    const [
      todayTotal,
      todayPresent,
      todayAbsent,
      monthTotal,
      monthPresent,
      prevMonthTotal,
      prevMonthPresent,
    ] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: todayWhere }),
      presentId
        ? this.prisma.attendanceRecord.count({ where: { ...todayWhere, statusId: presentId } })
        : Promise.resolve(0),
      absentId
        ? this.prisma.attendanceRecord.count({ where: { ...todayWhere, statusId: absentId } })
        : Promise.resolve(0),
      this.prisma.attendanceRecord.count({
        where: { ...studentFilter, date: { gte: monthStart, lte: today } },
      }),
      presentId
        ? this.prisma.attendanceRecord.count({
            where: { ...studentFilter, date: { gte: monthStart, lte: today }, statusId: presentId },
          })
        : Promise.resolve(0),
      this.prisma.attendanceRecord.count({
        where: { ...studentFilter, date: { gte: thirtyAgo, lt: monthStart } },
      }),
      presentId
        ? this.prisma.attendanceRecord.count({
            where: {
              ...studentFilter,
              date: { gte: thirtyAgo, lt: monthStart },
              statusId: presentId,
            },
          })
        : Promise.resolve(0),
    ]);

    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;
    const monthAvg = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;
    const prevMonthAvg = prevMonthTotal > 0 ? Math.round((prevMonthPresent / prevMonthTotal) * 100) : 0;

    const result: AttendanceStatsResponse = {
      todayRate: countWithTrend(todayRate, prevMonthAvg),
      monthAverage: countWithTrend(monthAvg, prevMonthAvg),
      presentToday: countWithTrend(todayPresent, 0),
      absentToday: countWithTrend(todayAbsent, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async getTrend(branchId: string | null, month: string): Promise<AttendanceTrendResponse> {
    const cacheKey = `attendance:trend:${branchId ?? 'all'}:${month}`;
    const cached = this.ttlCache.get<AttendanceTrendResponse>(cacheKey);
    if (cached) return cached;

    const { from, to, dates } = monthDateRange(month);
    const branchFilter = branchId ? { branchId } : {};
    const presentId = await this.lookupCache.getStatusId('attendance_status', 'present');

    const records = await this.prisma.attendanceRecord.groupBy({
      by: ['date'],
      where: {
        entityType: ATTENDANCE_ENTITY_STUDENT,
        ...branchFilter,
        date: { gte: from, lte: to },
      },
      _count: { _all: true },
    });

    const presentByDate = presentId
      ? await this.prisma.attendanceRecord.groupBy({
          by: ['date'],
          where: {
            entityType: ATTENDANCE_ENTITY_STUDENT,
            ...branchFilter,
            date: { gte: from, lte: to },
            statusId: presentId,
          },
          _count: { _all: true },
        })
      : [];

    const totalMap = new Map(records.map((r) => [r.date.toISOString().slice(0, 10), r._count._all]));
    const presentMap = new Map(
      presentByDate.map((r) => [r.date.toISOString().slice(0, 10), r._count._all]),
    );

    const points = dates.map((label) => {
      const total = totalMap.get(label) ?? 0;
      const present = presentMap.get(label) ?? 0;
      const value = total > 0 ? Math.round((present / total) * 100) : 0;
      return { label: label.slice(8), value };
    });

    const avg = points.length > 0 ? Math.round(points.reduce((s, p) => s + p.value, 0) / points.length) : 0;
    const result: AttendanceTrendResponse = { points, changePercent: countWithTrend(avg, avg).changePercent };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

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

  async getGrid(query: AttendanceGridQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('branchId is required');
    }

    const { from, to, dates } = monthDateRange(query.month);

    if (query.entityType === 'student') {
      const batch = await this.prisma.batch.findFirst({
        where: {
          id: query.batchId!,
          branchId: effectiveBranchId,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });
      if (!batch) throw new NotFoundException('Batch not found');

      const students = await this.prisma.student.findMany({
        where: {
          branchId: effectiveBranchId,
          batchId: batch.id,
          deletedAt: null,
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          gender: true,
          photographUrl: true,
        },
      });

      const studentIds = students.map((s) => s.id);
      const records = studentIds.length
        ? await this.prisma.attendanceRecord.findMany({
            where: {
              entityType: ATTENDANCE_ENTITY_STUDENT,
              entityId: { in: studentIds },
              branchId: effectiveBranchId,
              date: { gte: from, lte: to },
            },
            select: { entityId: true, date: true, statusId: true },
          })
        : [];

      const statusIds = [...new Set(records.map((r) => r.statusId))];
      const statuses = statusIds.length
        ? await this.prisma.lookupStatus.findMany({
            where: { id: { in: statusIds } },
            select: { id: true, code: true, label: true },
          })
        : [];
      const statusMap = new Map(statuses.map((s) => [s.id, s]));

      const recordMap = new Map<
        string,
        Map<string, { statusId: string; code: string; label: string }>
      >();
      for (const record of records) {
        const dateKey = record.date.toISOString().slice(0, 10);
        const status = statusMap.get(record.statusId);
        if (!status) continue;
        if (!recordMap.has(record.entityId)) {
          recordMap.set(record.entityId, new Map());
        }
        recordMap.get(record.entityId)!.set(dateKey, {
          statusId: status.id,
          code: status.code,
          label: status.label,
        });
      }

      return {
        month: query.month,
        branchId: effectiveBranchId,
        batchId: batch.id,
        batchName: batch.name,
        entityType: 'student' as const,
        total: students.length,
        dates,
        rows: students.map((student) => ({
          id: student.id,
          fullName: student.fullName,
          subtitle: batch.name,
          gender: student.gender,
          photographUrl: student.photographUrl,
          attendance: Object.fromEntries(
            dates.map((dateKey) => [dateKey, recordMap.get(student.id)?.get(dateKey) ?? null]),
          ),
        })),
      };
    }

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
      select: {
        id: true,
        fullName: true,
        gender: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    const userIds = users.map((u) => u.id);
    const records = userIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            entityType: query.entityType,
            entityId: { in: userIds },
            branchId: effectiveBranchId,
            date: { gte: from, lte: to },
          },
          select: { entityId: true, date: true, statusId: true },
        })
      : [];

    const statusIds = [...new Set(records.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    const recordMap = new Map<
      string,
      Map<string, { statusId: string; code: string; label: string }>
    >();
    for (const record of records) {
      const dateKey = record.date.toISOString().slice(0, 10);
      const status = statusMap.get(record.statusId);
      if (!status) continue;
      if (!recordMap.has(record.entityId)) {
        recordMap.set(record.entityId, new Map());
      }
      recordMap.get(record.entityId)!.set(dateKey, {
        statusId: status.id,
        code: status.code,
        label: status.label,
      });
    }

    const entityLabel = query.entityType === 'teacher' ? 'Teacher' : 'Staff';

    return {
      month: query.month,
      branchId: effectiveBranchId,
      batchId: null,
      batchName: null,
      entityType: query.entityType,
      total: users.length,
      dates,
      rows: users.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        subtitle: member.userRoles[0]?.role.name ?? entityLabel,
        gender: member.gender,
        photographUrl: null,
        attendance: Object.fromEntries(
          dates.map((dateKey) => [dateKey, recordMap.get(member.id)?.get(dateKey) ?? null]),
        ),
      })),
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
