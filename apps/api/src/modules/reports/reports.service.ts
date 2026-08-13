import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { computeChangePercent } from '../../common/utils/metrics.util';
import { paginatedResult } from '../../common/utils/pagination.util';
import {
  prismaBranchFilter,
  scopeCacheKey,
  sqlBranchFilter,
} from '../../common/utils/branch-scope.util';
import { getSingleBranchId } from '@eims/shared';
import type { BranchScope, ListFeeDefaultersQuery, FeeDefaultersSummaryQuery } from '@eims/shared';
import type { FeeDefaultersSummaryResponse, PaginatedResponse } from '@eims/types';

const OVERVIEW_CACHE_TTL_MS = 45_000;

function dueDayStart(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

function dueDayEnd(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T23:59:59.999Z`);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getOverview(scope: BranchScope) {
    const cacheKey = `reports:overview:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<ReportsService['buildOverview']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildOverview(scope);
    this.ttlCache.set(cacheKey, result, OVERVIEW_CACHE_TTL_MS);
    return result;
  }

  private async buildOverview(scope: BranchScope) {
    const branchFilter = prismaBranchFilter(scope);
    const hasBranchFilter = scope.kind === 'selected';
    const sqlFilter = sqlBranchFilter(scope, '"branchId"');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

    const weekAgo = new Date(today);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

    const parentWhere = hasBranchFilter
      ? {
          deletedAt: null,
          studentParents: { some: { student: { ...branchFilter, deletedAt: null } } },
        }
      : { deletedAt: null };

    const parentWherePrevious = hasBranchFilter
      ? {
          deletedAt: null,
          createdAt: { lte: thirtyDaysAgo },
          studentParents: { some: { student: { ...branchFilter, deletedAt: null } } },
        }
      : { deletedAt: null, createdAt: { lte: thirtyDaysAgo } };

    const [
      studentCount,
      studentCountPrevious,
      attendanceToday,
      attendanceWeekAgo,
      parentCount,
      parentCountPrevious,
      userCount,
      feeRow,
      feesCollectedLast30,
      feesCollectedPrevious30,
    ] = await Promise.all([
      this.prisma.student.count({ where: { ...branchFilter, deletedAt: null } }),
      this.prisma.student.count({
        where: { ...branchFilter, deletedAt: null, createdAt: { lte: thirtyDaysAgo } },
      }),
      this.prisma.attendanceRecord.count({
        where: { ...branchFilter, date: today, entityType: 'student' },
      }),
      this.prisma.attendanceRecord.count({
        where: { ...branchFilter, date: weekAgo, entityType: 'student' },
      }),
      this.prisma.parent.count({ where: parentWhere }),
      this.prisma.parent.count({ where: parentWherePrevious }),
      this.prisma.user.count({ where: { ...branchFilter, deletedAt: null, isActive: true } }),
      this.prisma.$queryRaw<
        Array<{
          pending_count: bigint;
          paid_count: bigint;
          pending_amount: unknown;
          collected_amount: unknown;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE "paidAt" IS NULL)::bigint AS pending_count,
          COUNT(*) FILTER (WHERE "paidAt" IS NOT NULL)::bigint AS paid_count,
          COALESCE(SUM("netAmount") FILTER (WHERE "paidAt" IS NULL), 0) AS pending_amount,
          COALESCE(SUM("netAmount") FILTER (WHERE "paidAt" IS NOT NULL), 0) AS collected_amount
        FROM "FeeInvoice"
        WHERE TRUE
          ${sqlFilter}
      `,
      this.prisma.$queryRaw<Array<{ total: unknown }>>`
        SELECT COALESCE(SUM("netAmount"), 0) AS total
        FROM "FeeInvoice"
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= ${thirtyDaysAgo}
          ${sqlFilter}
      `,
      this.prisma.$queryRaw<Array<{ total: unknown }>>`
        SELECT COALESCE(SUM("netAmount"), 0) AS total
        FROM "FeeInvoice"
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= ${sixtyDaysAgo}
          AND "paidAt" < ${thirtyDaysAgo}
          ${sqlFilter}
      `,
    ]);

    const fees = feeRow[0] ?? {
      pending_count: 0n,
      paid_count: 0n,
      pending_amount: 0,
      collected_amount: 0,
    };

    const collectedLast30 = Number(feesCollectedLast30[0]?.total ?? 0);
    const collectedPrevious30 = Number(feesCollectedPrevious30[0]?.total ?? 0);

    return {
      branchId: getSingleBranchId(scope),
      students: {
        total: studentCount,
        changePercent: computeChangePercent(studentCount, studentCountPrevious),
      },
      fees: {
        pendingCount: Number(fees.pending_count),
        paidCount: Number(fees.paid_count),
        pendingAmount: Number(fees.pending_amount ?? 0),
        collectedAmount: Number(fees.collected_amount ?? 0),
        collectedLast30Days: collectedLast30,
        changePercent: computeChangePercent(collectedLast30, collectedPrevious30),
      },
      attendanceMarkedToday: {
        count: attendanceToday,
        changePercent: computeChangePercent(attendanceToday, attendanceWeekAgo),
      },
      parents: {
        total: parentCount,
        changePercent: computeChangePercent(parentCount, parentCountPrevious),
      },
      staffUsers: userCount,
    };
  }

  async getFeeDefaulters(
    scope: BranchScope,
    query: ListFeeDefaultersQuery = { page: 1, limit: 8 },
  ): Promise<PaginatedResponse<{
    id: string;
    student: { id: string; fullName: string; phone: string | null; batchId: string | null };
    feeType: { id: string; name: string; code: string | null } | null;
    netAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string | null;
    createdAt: string;
  }>> {
    const branchFilter = prismaBranchFilter(scope);
    const today = new Date();
    const search = query.search?.trim();
    const dueDateRange =
      query.dueFrom || query.dueTo
        ? {
            ...(query.dueFrom ? { gte: dueDayStart(query.dueFrom) } : {}),
            ...(query.dueTo ? { lte: dueDayEnd(query.dueTo) } : {}),
          }
        : undefined;

    const where = {
      ...branchFilter,
      paidAt: null,
      AND: [
        { OR: [{ dueDate: null }, { dueDate: { lt: today } }] },
        ...(dueDateRange ? [{ dueDate: dueDateRange }] : []),
        ...(search
          ? [
              {
                student: {
                  fullName: { contains: search, mode: 'insensitive' as const },
                },
              },
            ]
          : []),
      ],
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [invoices, total] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where,
        include: {
          student: { select: { id: true, fullName: true, phone: true, batchId: true } },
          payments: {
            where: { status: { in: ['succeeded', 'completed'] } },
            select: { amount: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.feeInvoice.count({ where }),
    ]);

    const feeTypeIds = [...new Set(invoices.map((i) => i.feeTypeId))];
    const feeTypes = feeTypeIds.length
      ? await this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } })
      : [];
    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));

    return paginatedResult(
      invoices.map((inv) => {
        const paidAmount = Math.round(
          ((inv.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0) + Number.EPSILON) * 100,
        ) / 100;
        const netAmount = Math.round((Number(inv.netAmount) + Number.EPSILON) * 100) / 100;
        const remainingAmount = Math.max(0, Math.round((netAmount - paidAmount + Number.EPSILON) * 100) / 100);
        return {
          id: inv.id,
          student: inv.student,
          feeType: feeTypeMap.get(inv.feeTypeId) ?? null,
          netAmount,
          paidAmount,
          remainingAmount,
          dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
          createdAt: inv.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
    );
  }

  async getFeeDefaultersSummary(
    scope: BranchScope,
    query: FeeDefaultersSummaryQuery = {},
  ): Promise<FeeDefaultersSummaryResponse> {
    const branchFilter = prismaBranchFilter(scope);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const search = query.search?.trim();
    const dueDateRange =
      query.dueFrom || query.dueTo
        ? {
            ...(query.dueFrom ? { gte: dueDayStart(query.dueFrom) } : {}),
            ...(query.dueTo ? { lte: dueDayEnd(query.dueTo) } : {}),
          }
        : undefined;

    const where = {
      ...branchFilter,
      paidAt: null,
      AND: [
        { OR: [{ dueDate: null }, { dueDate: { lt: today } }] },
        ...(dueDateRange ? [{ dueDate: dueDateRange }] : []),
        ...(search
          ? [
              {
                student: {
                  fullName: { contains: search, mode: 'insensitive' as const },
                },
              },
            ]
          : []),
      ],
    };

    const invoices = await this.prisma.feeInvoice.findMany({
      where,
      select: {
        netAmount: true,
        dueDate: true,
        payments: {
          where: { status: { in: ['succeeded', 'completed'] } },
          select: { amount: true },
        },
      },
    });

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const remainingOf = (inv: (typeof invoices)[number]) => {
      const paid = round2((inv.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0));
      const net = round2(Number(inv.netAmount));
      return Math.max(0, round2(net - paid));
    };

    const agingMap: Record<'0-30' | '31-60' | '61+', { count: number; remainingAmount: number }> = {
      '0-30': { count: 0, remainingAmount: 0 },
      '31-60': { count: 0, remainingAmount: 0 },
      '61+': { count: 0, remainingAmount: 0 },
    };

    const dayMs = 24 * 60 * 60 * 1000;
    for (const inv of invoices) {
      if (!inv.dueDate) continue;
      const remaining = remainingOf(inv);
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / dayMs));
      const bucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : '61+';
      agingMap[bucket].count += 1;
      agingMap[bucket].remainingAmount = round2(agingMap[bucket].remainingAmount + remaining);
    }

    const now = new Date();
    const trend: FeeDefaultersSummaryResponse['trend'] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59, 999));
      const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
      let remainingAmount = 0;
      let count = 0;
      for (const inv of invoices) {
        if (!inv.dueDate) continue;
        const due = inv.dueDate.getTime();
        if (due < monthStart.getTime() || due > monthEnd.getTime()) continue;
        remainingAmount = round2(remainingAmount + remainingOf(inv));
        count += 1;
      }
      trend.push({ month: monthKey, remainingAmount, count });
    }

    return {
      aging: (['0-30', '31-60', '61+'] as const).map((bucket) => ({
        bucket,
        count: agingMap[bucket].count,
        remainingAmount: agingMap[bucket].remainingAmount,
      })),
      trend,
    };
  }
}
