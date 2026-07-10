import { Injectable } from '@nestjs/common';
import { computeChangePercent } from '../../common/utils/metrics.util';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import type {
  AnalyticsCorrelationQuery,
  AnalyticsPerformanceQuery,
  AnalyticsTrendsQuery,
  AnalyticsWeakSubjectsQuery,
} from '@eims/shared';

const DASHBOARD_CACHE_TTL_MS = 45_000;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookupCache: LookupCacheService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getAttendanceTrends(query: AnalyticsTrendsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const from = new Date(query.from);
    const to = new Date(query.to);

    const presentStatusId = await this.lookupCache.getStatusId('attendance_status', 'present');

    const batchFilter = query.batchId
      ? Prisma.sql`AND ar."entityId" IN (
          SELECT s.id FROM "Student" s
          WHERE s."batchId" = ${query.batchId} AND s."deletedAt" IS NULL
        )`
      : Prisma.empty;

    const branchFilter = effectiveBranchId
      ? Prisma.sql`AND ar."branchId" = ${effectiveBranchId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; total: bigint; present: bigint }>
    >`
      SELECT
        ar.date AS date,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE ar."statusId" = ${presentStatusId ?? ''})::bigint AS present
      FROM "AttendanceRecord" ar
      WHERE ar."entityType" = 'student'
        AND ar.date >= ${from}::date
        AND ar.date <= ${to}::date
        ${branchFilter}
        ${batchFilter}
      GROUP BY ar.date
      ORDER BY ar.date ASC
    `;

    const trends = rows.map((row) => {
      const total = Number(row.total);
      const present = Number(row.present);
      const date = row.date.toISOString().slice(0, 10);
      return {
        date,
        total,
        present,
        rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      };
    });

    return { trends };
  }

  async getPerformance(query: AnalyticsPerformanceQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;

    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      select: { id: true, fullName: true, batchId: true },
      take: 200,
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) return { students: [], subjects: [] };

    const records = await this.prisma.assessmentRecord.findMany({
      where: {
        studentId: { in: studentIds },
        ...(query.assessmentId ? { assessmentId: query.assessmentId } : {}),
        percentage: { not: null },
      },
      select: { studentId: true, subjectId: true, percentage: true },
    });

    const subjectIds = [...new Set(records.map((r) => r.subjectId))];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
      : [];

    const byStudentSubject = new Map<string, number[]>();
    for (const rec of records) {
      const key = `${rec.studentId}:${rec.subjectId}`;
      const list = byStudentSubject.get(key) ?? [];
      list.push(Number(rec.percentage));
      byStudentSubject.set(key, list);
    }

    const studentPerformance = students.map((s) => {
      const subjectScores = subjects.map((sub) => {
        const scores = byStudentSubject.get(`${s.id}:${sub.id}`) ?? [];
        const avg =
          scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : null;
        return { subjectId: sub.id, subjectName: sub.name, averagePercentage: avg };
      });
      const allAvgs = subjectScores.map((x) => x.averagePercentage).filter((x): x is number => x !== null);
      const overall =
        allAvgs.length > 0
          ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10
          : null;
      return { studentId: s.id, fullName: s.fullName, overallPercentage: overall, subjects: subjectScores };
    });

    return { subjects, students: studentPerformance };
  }

  async getRankings(branchId: string | null, assessmentId?: string) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(assessmentId ? { id: assessmentId } : {}),
      },
      orderBy: { conductedAt: 'desc' },
      take: assessmentId ? 1 : 10,
      select: { id: true, name: true, conductedAt: true },
    });

    if (assessments.length === 0) return { rankings: [] };

    const assessmentIds = assessments.map((a) => a.id);
    const allRecords = await this.prisma.assessmentRecord.findMany({
      where: { assessmentId: { in: assessmentIds }, rank: { not: null } },
      include: { student: { select: { id: true, fullName: true, batchId: true } } },
      orderBy: { rank: 'asc' },
    });

    const recordsByAssessment = new Map<string, typeof allRecords>();
    for (const rec of allRecords) {
      const list = recordsByAssessment.get(rec.assessmentId) ?? [];
      if (list.length < 20) list.push(rec);
      recordsByAssessment.set(rec.assessmentId, list);
    }

    const results = assessments.map((assessment) => {
      const records = recordsByAssessment.get(assessment.id) ?? [];
      return {
        assessment,
        topStudents: records.map((r) => ({
          rank: r.rank,
          fullName: r.student.fullName,
          percentage: r.percentage ? Number(r.percentage) : null,
          grade: r.grade,
        })),
      };
    });

    return { rankings: results };
  }

  async getWeakSubjects(query: AnalyticsWeakSubjectsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;

    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      select: { id: true, fullName: true },
      take: 200,
    });

    if (students.length === 0) return { threshold: query.threshold, alerts: [] };

    const studentIds = students.map((s) => s.id);
    const studentNameMap = new Map(students.map((s) => [s.id, s.fullName]));

    const aggregates = await this.prisma.assessmentRecord.groupBy({
      by: ['studentId', 'subjectId'],
      where: {
        studentId: { in: studentIds },
        percentage: { not: null },
      },
      _avg: { percentage: true },
      having: {
        percentage: { _avg: { lt: query.threshold } },
      },
    });

    const subjectIds = [...new Set(aggregates.map((a) => a.subjectId))];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    const alerts = aggregates
      .map((agg) => ({
        studentId: agg.studentId,
        fullName: studentNameMap.get(agg.studentId) ?? '',
        subjectName: subjectNameMap.get(agg.subjectId) ?? '',
        averagePercentage: agg._avg.percentage ? Math.round(Number(agg._avg.percentage) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.averagePercentage - b.averagePercentage)
      .slice(0, 50);

    return { threshold: query.threshold, alerts };
  }

  async getAttendancePerformanceCorrelation(
    query: AnalyticsCorrelationQuery,
    branchId: string | null,
  ) {
    const effectiveBranchId = branchId ?? query.branchId;
    const periodDays = 30;
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      select: { id: true, fullName: true },
      take: 200,
    });

    if (students.length === 0) {
      return { periodDays, correlation: null, students: [] };
    }

    const studentIds = students.map((s) => s.id);

    const presentStatusId = await this.lookupCache.getStatusId('attendance_status', 'present');

    const [attendanceRecords, assessmentRecords] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          entityType: 'student',
          entityId: { in: studentIds },
          date: { gte: since },
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        select: { entityId: true, statusId: true },
      }),
      this.prisma.assessmentRecord.findMany({
        where: {
          studentId: { in: studentIds },
          percentage: { not: null },
        },
        select: { studentId: true, percentage: true },
      }),
    ]);

    const attendanceByStudent = new Map<string, { total: number; present: number }>();
    for (const rec of attendanceRecords) {
      const entry = attendanceByStudent.get(rec.entityId) ?? { total: 0, present: 0 };
      entry.total += 1;
      if (presentStatusId && rec.statusId === presentStatusId) entry.present += 1;
      attendanceByStudent.set(rec.entityId, entry);
    }

    const performanceByStudent = new Map<string, number[]>();
    for (const rec of assessmentRecords) {
      const list = performanceByStudent.get(rec.studentId) ?? [];
      list.push(Number(rec.percentage));
      performanceByStudent.set(rec.studentId, list);
    }

    const dataPoints = students
      .map((s) => {
        const att = attendanceByStudent.get(s.id);
        const scores = performanceByStudent.get(s.id) ?? [];
        const attendanceRate =
          att && att.total > 0
            ? Math.round((att.present / att.total) * 1000) / 10
            : null;
        const averagePercentage =
          scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : null;
        return {
          studentId: s.id,
          fullName: s.fullName,
          attendanceRate,
          averagePercentage,
        };
      })
      .filter(
        (p): p is typeof p & { attendanceRate: number; averagePercentage: number } =>
          p.attendanceRate !== null && p.averagePercentage !== null,
      );

    let correlation: number | null = null;
    if (dataPoints.length >= 2) {
      const xs = dataPoints.map((p) => p.attendanceRate);
      const ys = dataPoints.map((p) => p.averagePercentage);
      const n = xs.length;
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
      const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
      const sumY2 = ys.reduce((acc, y) => acc + y * y, 0);
      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      correlation = den > 0 ? Math.round((num / den) * 1000) / 1000 : null;
    }

    return { periodDays, correlation, students: dataPoints };
  }

  async getDashboardKpis(branchId: string | null) {
    const cacheKey = `analytics:dashboard:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<AnalyticsService['buildDashboardKpis']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildDashboardKpis(branchId);
    this.ttlCache.set(cacheKey, result, DASHBOARD_CACHE_TTL_MS);
    return result;
  }

  private async buildDashboardKpis(branchId: string | null) {
    const branchFilter = branchId ? { branchId } : {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const presentStatusId = await this.lookupCache.getStatusId('attendance_status', 'present');

    const [
      recentAssessments,
      previousAssessments,
      attendanceByStatus,
      previousAttendanceByStatus,
      avgPercentage,
      previousAvgPercentage,
    ] = await Promise.all([
      this.prisma.assessment.count({
        where: { ...branchFilter, conductedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.assessment.count({
        where: {
          ...branchFilter,
          conductedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['statusId'],
        where: {
          ...branchFilter,
          entityType: 'student',
          date: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['statusId'],
        where: {
          ...branchFilter,
          entityType: 'student',
          date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        _count: { _all: true },
      }),
      this.prisma.assessmentRecord.aggregate({
        where: {
          percentage: { not: null },
          assessment: { conductedAt: { gte: thirtyDaysAgo } },
          student: branchId ? { branchId } : undefined,
        },
        _avg: { percentage: true },
      }),
      this.prisma.assessmentRecord.aggregate({
        where: {
          percentage: { not: null },
          assessment: { conductedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
          student: branchId ? { branchId } : undefined,
        },
        _avg: { percentage: true },
      }),
    ]);

    const computeAttendanceRate = (
      rows: Array<{ statusId: string; _count: { _all: number } }>,
    ) => {
      let attendanceRecords = 0;
      let presentCount = 0;
      for (const row of rows) {
        attendanceRecords += row._count._all;
        if (presentStatusId && row.statusId === presentStatusId) {
          presentCount += row._count._all;
        }
      }
      return attendanceRecords > 0
        ? Math.round((presentCount / attendanceRecords) * 1000) / 10
        : 0;
    };

    const attendanceRate = computeAttendanceRate(attendanceByStatus);
    const previousAttendanceRate = computeAttendanceRate(previousAttendanceByStatus);

    let attendanceRecords = 0;
    for (const row of attendanceByStatus) {
      attendanceRecords += row._count._all;
    }

    const averageAssessmentPercentage = avgPercentage._avg.percentage
      ? Math.round(Number(avgPercentage._avg.percentage) * 10) / 10
      : null;
    const previousAverageAssessmentPercentage = previousAvgPercentage._avg.percentage
      ? Math.round(Number(previousAvgPercentage._avg.percentage) * 10) / 10
      : null;

    return {
      assessmentsLast30Days: {
        value: recentAssessments,
        changePercent: computeChangePercent(recentAssessments, previousAssessments),
      },
      attendanceRecordsLast30Days: attendanceRecords,
      attendanceRateLast30Days: {
        value: attendanceRate,
        changePercent: computeChangePercent(attendanceRate, previousAttendanceRate),
      },
      averageAssessmentPercentage: {
        value: averageAssessmentPercentage,
        changePercent:
          averageAssessmentPercentage !== null && previousAverageAssessmentPercentage !== null
            ? computeChangePercent(averageAssessmentPercentage, previousAverageAssessmentPercentage)
            : null,
      },
    };
  }
}
