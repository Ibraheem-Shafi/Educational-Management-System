import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { StudentsService } from '../students/students.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { computeChangePercent } from '../../common/utils/metrics.util';
import type {
  AuthUser,
  DashboardAttendanceRing,
  DashboardBranchPerformanceResponse,
  DashboardMonthlyRevenueResponse,
  DashboardRecentActivitiesResponse,
  DashboardStatsResponse,
  DashboardTodayAttendanceResponse,
} from '@eims/types';

const SUMMARY_CACHE_TTL_MS = 45_000;
const STATS_CACHE_TTL_MS = 45_000;
const CHARTS_CACHE_TTL_MS = 45_000;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const STAFF_ROLE_CODES = [
  'super_admin',
  'branch_admin',
  'teacher',
  'accountant',
  'receptionist',
] as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly analytics: AnalyticsService,
    private readonly students: StudentsService,
    private readonly ttlCache: TtlCacheService,
    private readonly lookupCache: LookupCacheService,
  ) {}

  async getTodayAttendance(branchId: string | null): Promise<DashboardTodayAttendanceResponse> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const cacheKey = `dashboard:today-attendance:${branchId ?? 'all'}:${today.toISOString().slice(0, 10)}`;
    const cached = this.ttlCache.get<DashboardTodayAttendanceResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildTodayAttendance(branchId, today);
    this.ttlCache.set(cacheKey, result, CHARTS_CACHE_TTL_MS);
    return result;
  }

  async getBranchPerformance(branchId: string | null): Promise<DashboardBranchPerformanceResponse> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const cacheKey = `dashboard:branch-performance:${branchId ?? 'all'}:${today.toISOString().slice(0, 10)}`;
    const cached = this.ttlCache.get<DashboardBranchPerformanceResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildBranchPerformance(branchId, today);
    this.ttlCache.set(cacheKey, result, CHARTS_CACHE_TTL_MS);
    return result;
  }

  async getRecentActivities(branchId: string | null): Promise<DashboardRecentActivitiesResponse> {
    const cacheKey = `dashboard:recent-activities:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<DashboardRecentActivitiesResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildRecentActivities(branchId);
    this.ttlCache.set(cacheKey, result, CHARTS_CACHE_TTL_MS);
    return result;
  }

  async getMonthlyRevenue(branchId: string | null): Promise<DashboardMonthlyRevenueResponse> {
    const fiscalYear = new Date().getUTCFullYear();
    const cacheKey = `dashboard:monthly-revenue:${branchId ?? 'all'}:${fiscalYear}`;
    const cached = this.ttlCache.get<DashboardMonthlyRevenueResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildMonthlyRevenue(branchId, fiscalYear);
    this.ttlCache.set(cacheKey, result, CHARTS_CACHE_TTL_MS);
    return result;
  }

  async getStats(branchId: string | null): Promise<DashboardStatsResponse> {
    const cacheKey = `dashboard:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<DashboardStatsResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildStats(branchId);
    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async getSummary(user: AuthUser, branchId: string | null) {
    const cacheKey = `dashboard:summary:${branchId ?? 'all'}:${user.id}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<DashboardService['buildSummary']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildSummary(user, branchId);
    this.ttlCache.set(cacheKey, result, SUMMARY_CACHE_TTL_MS);
    return result;
  }

  private async buildStats(branchId: string | null): Promise<DashboardStatsResponse> {
    const branchFilter = branchId ? { branchId } : {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const branchWhere = {
      deletedAt: null,
      isActive: true,
      ...(branchId ? { id: branchId } : {}),
    };
    const branchWherePrevious = {
      ...branchWhere,
      createdAt: { lte: thirtyDaysAgo },
    };

    const studentWhere = { ...branchFilter, deletedAt: null };
    const studentWherePrevious = { ...studentWhere, createdAt: { lte: thirtyDaysAgo } };

    const batchWhere = { ...branchFilter, deletedAt: null };
    const batchWherePrevious = { ...batchWhere, createdAt: { lte: thirtyDaysAgo } };

    const staffWhere = {
      deletedAt: null,
      isActive: true,
      ...(branchId ? { branchId } : {}),
      userRoles: { some: { role: { code: { in: [...STAFF_ROLE_CODES] } } } },
    };
    const staffWherePrevious = { ...staffWhere, createdAt: { lte: thirtyDaysAgo } };

    const [
      totalBranches,
      totalBranchesPrevious,
      totalStudents,
      totalStudentsPrevious,
      teachersAndStaff,
      teachersAndStaffPrevious,
      totalClasses,
      totalClassesPrevious,
    ] = await Promise.all([
      this.prisma.branch.count({ where: branchWhere }),
      this.prisma.branch.count({ where: branchWherePrevious }),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.count({ where: studentWherePrevious }),
      this.prisma.user.count({ where: staffWhere }),
      this.prisma.user.count({ where: staffWherePrevious }),
      this.prisma.batch.count({ where: batchWhere }),
      this.prisma.batch.count({ where: batchWherePrevious }),
    ]);

    return {
      totalBranches: {
        total: totalBranches,
        changePercent: computeChangePercent(totalBranches, totalBranchesPrevious),
      },
      totalStudents: {
        total: totalStudents,
        changePercent: computeChangePercent(totalStudents, totalStudentsPrevious),
      },
      teachersAndStaff: {
        total: teachersAndStaff,
        changePercent: computeChangePercent(teachersAndStaff, teachersAndStaffPrevious),
      },
      totalClasses: {
        total: totalClasses,
        changePercent: computeChangePercent(totalClasses, totalClassesPrevious),
      },
    };
  }

  private async buildSummary(user: AuthUser, branchId: string | null) {
    const canViewReports = user.permissions.includes('reports.view');
    const canViewAnalytics = user.permissions.includes('analytics.read');

    const [overview, analytics, recentStudents] = await Promise.all([
      canViewReports ? this.reports.getOverview(branchId) : Promise.resolve(null),
      canViewAnalytics ? this.analytics.getDashboardKpis(branchId) : Promise.resolve(null),
      this.students.findAll({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }, branchId),
    ]);

    return { overview, analytics, recentStudents };
  }

  private async buildTodayAttendance(
    branchId: string | null,
    today: Date,
  ): Promise<DashboardTodayAttendanceResponse> {
    const presentStatusId = await this.lookupCache.getStatusId('attendance_status', 'present');
    const branchFilter = branchId ? Prisma.sql`AND ar."branchId" = ${branchId}` : Prisma.empty;
    const presentCountSql = presentStatusId
      ? Prisma.sql`COUNT(*) FILTER (WHERE ar."statusId" = ${presentStatusId})::bigint`
      : Prisma.sql`0::bigint`;

    const rows = await this.prisma.$queryRaw<
      Array<{ entity_type: string; total: bigint; present: bigint }>
    >`
      SELECT
        ar."entityType" AS entity_type,
        COUNT(*)::bigint AS total,
        ${presentCountSql} AS present
      FROM "AttendanceRecord" ar
      WHERE ar.date = ${today}::date
      ${branchFilter}
      GROUP BY ar."entityType"
    `;

    const byType = new Map(rows.map((row) => [row.entity_type, row]));

    const studentsRow = byType.get('student');
    const teacherRow = byType.get('teacher');
    const staffRow = byType.get('staff');

    const students = this.toAttendanceRing(studentsRow);
    const teachersAndStaff = this.combineAttendanceRings(
      this.toAttendanceRing(teacherRow),
      this.toAttendanceRing(staffRow),
    );
    const overall = this.combineAttendanceRings(students, teachersAndStaff);

    return {
      date: today.toISOString().slice(0, 10),
      dateLabel: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      scopeLabel: branchId ? 'This branch' : 'Across all branches',
      students,
      teachersAndStaff,
      overall,
    };
  }

  private formatBranchAddress(city: string | null, address: string | null): string {
    if (city && address) {
      const locality = address.split(',')[0]?.trim() || address;
      return `${city}, ${locality}`;
    }
    return city ?? address ?? '—';
  }

  private async buildBranchPerformance(
    branchId: string | null,
    today: Date,
  ): Promise<DashboardBranchPerformanceResponse> {
    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { id: branchId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        email: true,
        isActive: true,
      },
    });

    if (branches.length === 0) {
      return { branches: [] };
    }

    const branchIds = branches.map((branch) => branch.id);
    const presentStatusId = await this.lookupCache.getStatusId('attendance_status', 'present');
    const presentCountSql = presentStatusId
      ? Prisma.sql`COUNT(*) FILTER (WHERE ar."statusId" = ${presentStatusId})::bigint`
      : Prisma.sql`0::bigint`;

    const [studentCounts, attendanceRows, principals] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['branchId'],
        where: { branchId: { in: branchIds }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ branch_id: string; total: bigint; present: bigint }>>`
        SELECT
          ar."branchId" AS branch_id,
          COUNT(*)::bigint AS total,
          ${presentCountSql} AS present
        FROM "AttendanceRecord" ar
        WHERE ar.date = ${today}::date
          AND ar."entityType" = 'student'
          AND ar."branchId" IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}`))})
        GROUP BY ar."branchId"
      `,
      this.prisma.user.findMany({
        where: {
          branchId: { in: branchIds },
          deletedAt: null,
          isActive: true,
          userRoles: { some: { role: { code: 'branch_admin' } } },
        },
        select: { branchId: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    const studentsByBranch = new Map(
      studentCounts.map((row) => [row.branchId, row._count._all]),
    );
    const attendanceByBranch = new Map(
      attendanceRows.map((row) => {
        const total = Number(row.total);
        const present = Number(row.present);
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        return [row.branch_id, rate] as const;
      }),
    );
    const principalByBranch = new Map<string, string>();
    for (const principal of principals) {
      if (principal.branchId && !principalByBranch.has(principal.branchId)) {
        principalByBranch.set(principal.branchId, principal.fullName);
      }
    }

    return {
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        addressLabel: this.formatBranchAddress(branch.city, branch.address),
        email: branch.email,
        phone: branch.phone,
        principalName: principalByBranch.get(branch.id) ?? null,
        studentCount: studentsByBranch.get(branch.id) ?? 0,
        attendanceRate: attendanceByBranch.get(branch.id) ?? 0,
        isActive: branch.isActive,
      })),
    };
  }

  private async buildMonthlyRevenue(
    branchId: string | null,
    fiscalYear: number,
  ): Promise<DashboardMonthlyRevenueResponse> {
    const yearStart = new Date(Date.UTC(fiscalYear, 0, 1));
    const yearEnd = new Date(Date.UTC(fiscalYear + 1, 0, 1));
    const prevYearStart = new Date(Date.UTC(fiscalYear - 1, 0, 1));
    const prevYearEnd = new Date(Date.UTC(fiscalYear, 0, 1));

    const branchFilter = branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty;

    const [monthRows, totalRow, prevTotalRow] = await Promise.all([
      this.prisma.$queryRaw<Array<{ month: number; total: unknown }>>`
        SELECT
          EXTRACT(MONTH FROM "paidAt")::int AS month,
          COALESCE(SUM("netAmount"), 0) AS total
        FROM "FeeInvoice"
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= ${yearStart}
          AND "paidAt" < ${yearEnd}
          ${branchFilter}
        GROUP BY EXTRACT(MONTH FROM "paidAt")
        ORDER BY 1 ASC
      `,
      this.prisma.$queryRaw<Array<{ total: unknown }>>`
        SELECT COALESCE(SUM("netAmount"), 0) AS total
        FROM "FeeInvoice"
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= ${yearStart}
          AND "paidAt" < ${yearEnd}
          ${branchFilter}
      `,
      this.prisma.$queryRaw<Array<{ total: unknown }>>`
        SELECT COALESCE(SUM("netAmount"), 0) AS total
        FROM "FeeInvoice"
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= ${prevYearStart}
          AND "paidAt" < ${prevYearEnd}
          ${branchFilter}
      `,
    ]);

    const amountByMonth = new Map(monthRows.map((row) => [row.month, Number(row.total ?? 0)]));
    const months = MONTH_LABELS.map((label, index) => ({
      month: index + 1,
      label,
      amount: amountByMonth.get(index + 1) ?? 0,
    }));

    const totalAmount = Number(totalRow[0]?.total ?? 0);
    const previousYearTotal = Number(prevTotalRow[0]?.total ?? 0);

    return {
      fiscalYear,
      totalAmount,
      changePercentVsLastYear: computeChangePercent(totalAmount, previousYearTotal),
      months,
    };
  }

  private async buildRecentActivities(
    branchId: string | null,
  ): Promise<DashboardRecentActivitiesResponse> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    const branchFilter = branchId ? { branchId } : {};
    const branchIdFilter = branchId ? { id: branchId } : {};

    type ActivityDraft = {
      id: string;
      title: string;
      description: string;
      kind: DashboardRecentActivitiesResponse['activities'][number]['kind'];
      occurredAt: Date;
    };

    const drafts: ActivityDraft[] = [];

    const [students, paidInvoices, teacherSlots, attendanceGroups, branchUpdates, documents] =
      await Promise.all([
        this.prisma.student.findMany({
          where: { deletedAt: null, createdAt: { gte: since }, ...branchFilter },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            fullName: true,
            createdAt: true,
            branch: { select: { name: true } },
          },
        }),
        this.prisma.feeInvoice.findMany({
          where: { paidAt: { not: null, gte: since }, ...branchFilter },
          orderBy: { paidAt: 'desc' },
          take: 8,
          select: { id: true, netAmount: true, paidAt: true, branchId: true },
        }),
        this.prisma.timetableSlot.findMany({
          where: { teacherId: { not: null }, createdAt: { gte: since }, ...branchFilter },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, teacherId: true, batchId: true, createdAt: true },
        }),
        this.prisma.$queryRaw<
          Array<{ branch_id: string; batch_id: string | null; session_date: Date; latest_at: Date }>
        >`
          SELECT
            ar."branchId" AS branch_id,
            s."batchId" AS batch_id,
            ar.date AS session_date,
            MAX(ar."createdAt") AS latest_at
          FROM "AttendanceRecord" ar
          INNER JOIN "Student" s ON s.id = ar."entityId" AND s."deletedAt" IS NULL
          WHERE ar."entityType" = 'student'
            AND ar."createdAt" >= ${since}
            ${branchId ? Prisma.sql`AND ar."branchId" = ${branchId}` : Prisma.empty}
          GROUP BY ar."branchId", s."batchId", ar.date
          ORDER BY latest_at DESC
          LIMIT 8
        `,
        this.prisma.branch.findMany({
          where: { deletedAt: null, updatedAt: { gte: since }, ...branchIdFilter },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.document.findMany({
          where: { deletedAt: null, createdAt: { gte: since }, ...branchFilter },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, createdAt: true },
        }),
      ]);

    for (const student of students) {
      drafts.push({
        id: `student-${student.id}`,
        title: 'New student admitted',
        description: `${student.fullName} · ${student.branch.name}`,
        kind: 'student',
        occurredAt: student.createdAt,
      });
    }

    const branchIds = new Set<string>();
    for (const invoice of paidInvoices) branchIds.add(invoice.branchId);
    for (const group of attendanceGroups) branchIds.add(group.branch_id);

    const batchIds = [
      ...new Set([
        ...teacherSlots.map((slot) => slot.batchId),
        ...attendanceGroups.map((group) => group.batch_id).filter((id): id is string => !!id),
      ]),
    ];
    const teacherIds = [
      ...new Set(
        teacherSlots.map((slot) => slot.teacherId).filter((id): id is string => !!id),
      ),
    ];

    const [branches, batches, teachers] = await Promise.all([
      branchIds.size
        ? this.prisma.branch.findMany({
            where: { id: { in: [...branchIds] } },
            select: { id: true, name: true },
          })
        : [],
      batchIds.length
        ? this.prisma.batch.findMany({
            where: { id: { in: batchIds }, deletedAt: null },
            select: { id: true, name: true },
          })
        : [],
      teacherIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: teacherIds }, deletedAt: null },
            select: { id: true, fullName: true },
          })
        : [],
    ]);

    const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));
    const batchMap = new Map(batches.map((batch) => [batch.id, batch.name]));
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher.fullName]));

    for (const invoice of paidInvoices) {
      if (!invoice.paidAt) continue;
      const amount = Number(invoice.netAmount).toLocaleString('en-US');
      const branchName = branchMap.get(invoice.branchId) ?? 'Campus';
      drafts.push({
        id: `fee-${invoice.id}`,
        title: 'Fee payment received',
        description: `${amount} · ${branchName}`,
        kind: 'fee',
        occurredAt: invoice.paidAt,
      });
    }

    for (const slot of teacherSlots) {
      if (!slot.teacherId) continue;
      const teacherName = teacherMap.get(slot.teacherId) ?? 'Teacher';
      const batchName = batchMap.get(slot.batchId) ?? 'Class';
      drafts.push({
        id: `teacher-${slot.id}`,
        title: 'Teacher assigned',
        description: `${teacherName} → ${batchName}`,
        kind: 'teacher',
        occurredAt: slot.createdAt,
      });
    }

    for (const group of attendanceGroups) {
      const branchName = branchMap.get(group.branch_id) ?? 'Campus';
      const batchName = group.batch_id ? (batchMap.get(group.batch_id) ?? 'Class') : 'All classes';
      drafts.push({
        id: `attendance-${group.branch_id}-${group.batch_id ?? 'all'}-${group.session_date.toISOString().slice(0, 10)}`,
        title: 'Attendance completed',
        description: `${branchName} · ${batchName}`,
        kind: 'attendance',
        occurredAt: group.latest_at,
      });
    }

    for (const branch of branchUpdates) {
      const isReopen =
        branch.isActive && branch.updatedAt.getTime() - branch.createdAt.getTime() > 60_000;
      drafts.push({
        id: `branch-${branch.id}-${branch.updatedAt.toISOString()}`,
        title: 'Branch updated',
        description: isReopen ? `${branch.name} re-opened` : branch.name,
        kind: 'branch',
        occurredAt: branch.updatedAt,
      });
    }

    for (const doc of documents) {
      drafts.push({
        id: `report-${doc.id}`,
        title: 'Report generated',
        description: doc.title,
        kind: 'report',
        occurredAt: doc.createdAt,
      });
    }

    return {
      activities: drafts
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          kind: item.kind,
          occurredAt: item.occurredAt.toISOString(),
        })),
    };
  }

  private toAttendanceRing(row?: { total: bigint; present: bigint }): DashboardAttendanceRing {
    const totalCount = Number(row?.total ?? 0);
    const presentCount = Number(row?.present ?? 0);
    const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    return { rate, presentCount, totalCount };
  }

  private combineAttendanceRings(
    a: DashboardAttendanceRing,
    b: DashboardAttendanceRing,
  ): DashboardAttendanceRing {
    const presentCount = a.presentCount + b.presentCount;
    const totalCount = a.totalCount + b.totalCount;
    const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    return { rate, presentCount, totalCount };
  }
}
