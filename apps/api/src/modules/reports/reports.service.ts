import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';

const OVERVIEW_CACHE_TTL_MS = 45_000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getOverview(branchId: string | null) {
    const cacheKey = `reports:overview:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<ReportsService['buildOverview']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildOverview(branchId);
    this.ttlCache.set(cacheKey, result, OVERVIEW_CACHE_TTL_MS);
    return result;
  }

  private async buildOverview(branchId: string | null) {
    const branchFilter = branchId ? { branchId } : {};
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const parentWhere = branchId
      ? {
          deletedAt: null,
          studentParents: { some: { student: { branchId, deletedAt: null } } },
        }
      : { deletedAt: null };

    const [studentCount, attendanceToday, parentCount, userCount, feeRow] = await Promise.all([
      this.prisma.student.count({ where: { ...branchFilter, deletedAt: null } }),
      this.prisma.attendanceRecord.count({
        where: { ...branchFilter, date: today, entityType: 'student' },
      }),
      this.prisma.parent.count({ where: parentWhere }),
      this.prisma.user.count({ where: { ...branchFilter, deletedAt: null, isActive: true } }),
      branchId
        ? this.prisma.$queryRaw<
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
            WHERE "branchId" = ${branchId}
          `
        : this.prisma.$queryRaw<
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
          `,
    ]);

    const fees = feeRow[0] ?? {
      pending_count: 0n,
      paid_count: 0n,
      pending_amount: 0,
      collected_amount: 0,
    };

    return {
      branchId,
      students: { total: studentCount },
      fees: {
        pendingCount: Number(fees.pending_count),
        paidCount: Number(fees.paid_count),
        pendingAmount: Number(fees.pending_amount ?? 0),
        collectedAmount: Number(fees.collected_amount ?? 0),
      },
      attendanceMarkedToday: attendanceToday,
      parents: parentCount,
      staffUsers: userCount,
    };
  }

  async getFeeDefaulters(branchId: string | null) {
    const branchFilter = branchId ? { branchId } : {};
    const today = new Date();

    const invoices = await this.prisma.feeInvoice.findMany({
      where: {
        ...branchFilter,
        paidAt: null,
        OR: [{ dueDate: null }, { dueDate: { lt: today } }],
      },
      include: {
        student: { select: { id: true, fullName: true, phone: true, batchId: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });

    const feeTypeIds = [...new Set(invoices.map((i) => i.feeTypeId))];
    const feeTypes = feeTypeIds.length
      ? await this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } })
      : [];
    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));

    return {
      data: invoices.map((inv) => ({
        id: inv.id,
        student: inv.student,
        feeType: feeTypeMap.get(inv.feeTypeId) ?? null,
        netAmount: Number(inv.netAmount),
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
        createdAt: inv.createdAt.toISOString(),
      })),
      total: invoices.length,
    };
  }
}
