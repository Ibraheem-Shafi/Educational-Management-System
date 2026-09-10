import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import { getSingleBranchId } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { countWithTrend, todayStart } from '../../common/utils/stats.util';
import { computeChangePercent } from '../../common/utils/metrics.util';
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
import { assertTeacherAssignedBatch } from '../../common/utils/teacher-assignment.util';

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
    private readonly communications: CommunicationsService,
  ) {}

  async getStats(scope: BranchScope): Promise<AttendanceStatsResponse> {
    const cacheKey = `attendance:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<AttendanceStatsResponse>(cacheKey);
    if (cached) return cached;

    const today = todayStart();
    const branchFilter = prismaBranchFilter(scope);
    const studentFilter = { entityType: ATTENDANCE_ENTITY_STUDENT, ...branchFilter };

    const [presentId, absentId] = await Promise.all([
      this.lookupCache.getStatusId('attendance_status', 'present'),
      this.lookupCache.getStatusId('attendance_status', 'absent'),
    ]);

    const todayWhere = { ...studentFilter, date: today };

    // Yesterday, for a meaningful day-over-day comparison on Today's rate.
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayWhere = { ...studentFilter, date: yesterday };

    // Month average is computed over the previous *completed* calendar month,
    // excluding the current partial month.
    const currentMonthStart = new Date(today);
    currentMonthStart.setUTCDate(1);
    const prevMonthStart = new Date(currentMonthStart);
    prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);

    const [
      todayTotal,
      todayPresent,
      todayAbsent,
      yesterdayTotal,
      yesterdayPresent,
      completedMonthTotal,
      completedMonthPresent,
    ] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: todayWhere }),
      presentId
        ? this.prisma.attendanceRecord.count({ where: { ...todayWhere, statusId: presentId } })
        : Promise.resolve(0),
      absentId
        ? this.prisma.attendanceRecord.count({ where: { ...todayWhere, statusId: absentId } })
        : Promise.resolve(0),
      this.prisma.attendanceRecord.count({ where: yesterdayWhere }),
      presentId
        ? this.prisma.attendanceRecord.count({ where: { ...yesterdayWhere, statusId: presentId } })
        : Promise.resolve(0),
      this.prisma.attendanceRecord.count({
        where: { ...studentFilter, date: { gte: prevMonthStart, lt: currentMonthStart } },
      }),
      presentId
        ? this.prisma.attendanceRecord.count({
            where: {
              ...studentFilter,
              date: { gte: prevMonthStart, lt: currentMonthStart },
              statusId: presentId,
            },
          })
        : Promise.resolve(0),
    ]);

    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;
    const yesterdayRate = yesterdayTotal > 0 ? Math.round((yesterdayPresent / yesterdayTotal) * 100) : 0;
    const monthAvg =
      completedMonthTotal > 0 ? Math.round((completedMonthPresent / completedMonthTotal) * 100) : 0;

    const result: AttendanceStatsResponse = {
      // Only show a day-over-day delta when today has recorded attendance;
      // otherwise there is nothing meaningful to compare against.
      todayRate: {
        total: todayRate,
        changePercent: todayTotal > 0 ? computeChangePercent(todayRate, yesterdayRate) : null,
      },
      // Month average over the previous completed month; no spurious trend chip.
      monthAverage: { total: monthAvg, changePercent: null },
      presentToday: countWithTrend(todayPresent, 0),
      absentToday: countWithTrend(todayAbsent, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async getTrend(scope: BranchScope, month: string): Promise<AttendanceTrendResponse> {
    const cacheKey = `attendance:trend:${scopeCacheKey(scope)}:${month}`;
    const cached = this.ttlCache.get<AttendanceTrendResponse>(cacheKey);
    if (cached) return cached;

    const { from, to, dates } = monthDateRange(month);
    const branchFilter = prismaBranchFilter(scope);
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

  async getSheet(query: AttendanceSheetQuery, scope: BranchScope, user?: AuthUser) {
    if (user) {
      await assertTeacherAssignedBatch(this.prisma, user, query.batchId);
    }
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branchId is required');
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
        select: { id: true, fullName: true, rollNumber: true, admissionNumber: true },
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
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
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

  async getSheetPrintData(query: AttendanceSheetQuery, scope: BranchScope) {
    const sheet = await this.getSheet(query, scope);
    const [settings, template] = await Promise.all([
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'attendance_sheet',
          isActive: true,
          OR: [{ branchId: sheet.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);
    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS.attendance_sheet;
    const stored =
      template?.fields && typeof template.fields === 'object' && !Array.isArray(template.fields)
        ? (template.fields as Record<string, boolean>)
        : {};
    return {
      ...sheet,
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
        name: template?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES.attendance_sheet,
      },
    };
  }

  async bulkMark(input: BulkAttendanceInput, user: AuthUser) {
    await assertTeacherAssignedBatch(this.prisma, user, input.batchId);
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

    let absenceAlerts: { sent: number; failed: number; skipped: number } | null = null;
    if (input.notifyAbsences !== false) {
      const absentStatusId = await this.lookupCache.getStatusId('attendance_status', 'absent');
      const absentStudentIds = input.records
        .filter((r) => absentStatusId && r.statusId === absentStatusId)
        .map((r) => r.studentId);
      if (absentStudentIds.length > 0) {
        try {
          absenceAlerts = await this.communications.sendAbsenceAlerts(
            {
              branchId: input.branchId,
              date: input.date,
              studentIds: absentStudentIds,
              channel: input.notifyChannel ?? 'whatsapp',
            },
            user,
          );
        } catch {
          absenceAlerts = { sent: 0, failed: absentStudentIds.length, skipped: 0 };
        }
      }
    }

    return {
      date: input.date,
      branchId: input.branchId,
      batchId: input.batchId,
      marked: results.length,
      absenceAlerts,
    };
  }

  async getGrid(query: AttendanceGridQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branchId is required');
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

  async getHistory(query: AttendanceHistoryQuery, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: query.studentId,
        deletedAt: null,
        ...prismaBranchFilter(scope),
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

  async getStaffSheet(query: StaffAttendanceSheetQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) throw new BadRequestException('A single branchId is required');

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
