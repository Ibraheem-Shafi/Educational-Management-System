import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { DocumentsService } from '../documents/documents.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, FeesRevenueTrendResponse, FeesStatsResponse, PaginatedResponse } from '@eims/types';
import type {
  CreateFeeInvoiceInput,
  ListFeeInvoicesQuery,
  ListFeeInvoicesByStudentQuery,
  ListFeeTypesQuery,
  RecordPaymentInput,
  RecordFeePaymentInput,
  PrepareFeePaymentReceiptUploadInput,
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  ListFeeStructuresQuery,
  GenerateBulkInvoicesInput,
  PreviewBulkInvoicesInput,
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  ListFeeChallansQuery,
  CreateFeeChallanInput,
  UpdateFeeInvoiceInput,
  UpdateFeeChallanInput,
  IncrementFeeRatesInput,
  UpdateStudentFeePolicyInput,
} from '@eims/shared';
import { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } from '@eims/shared';
import {
  applyFeeIncrement,
  billingPeriodFromDate,
  currentBillingPeriod,
  formatMonthlyVoucherNo,
  parseCalendarDate,
} from './fee-ops.util';

const STATS_CACHE_TTL_MS = 45_000;

/** Parse YYYY-MM-DD (or ISO) to start/end of that calendar day in UTC. */
function dueDayStart(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

function dueDayEnd(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T23:59:59.999Z`);
}

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
    private readonly accountingPosting: AccountingPostingService,
    private readonly documents: DocumentsService,
  ) {}

  async getStats(scope: BranchScope): Promise<FeesStatsResponse> {
    const cacheKey = `fees:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<FeesStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const thirtyAgo = thirtyDaysAgo();

    const [pendingStatus, paidStatus, overdueStatus] = await Promise.all([
      this.prisma.lookupStatus.findFirst({ where: { code: 'pending', category: { code: 'fee_status' } } }),
      this.prisma.lookupStatus.findFirst({ where: { code: 'paid', category: { code: 'fee_status' } } }),
      this.prisma.lookupStatus.findFirst({ where: { code: 'overdue', category: { code: 'fee_status' } } }),
    ]);

    const unpaidIds = [pendingStatus?.id, overdueStatus?.id].filter((id): id is string => !!id);

    const [
      outstandingAgg,
      prevOutstandingAgg,
      collectedAgg,
      prevCollectedAgg,
      overdueCount,
      prevOverdueCount,
      invoiceCount,
      prevInvoiceCount,
    ] = await Promise.all([
      this.prisma.feeInvoice.aggregate({
        where: { ...branchFilter, paidAt: null },
        _sum: { netAmount: true },
      }),
      this.prisma.feeInvoice.aggregate({
        where: { ...branchFilter, paidAt: null, createdAt: { lte: thirtyAgo } },
        _sum: { netAmount: true },
      }),
      this.prisma.feeInvoice.aggregate({
        where: { ...branchFilter, paidAt: { gte: thirtyAgo } },
        _sum: { netAmount: true },
      }),
      this.prisma.feeInvoice.aggregate({
        where: {
          ...branchFilter,
          paidAt: { gte: new Date(thirtyAgo.getTime() - 30 * 86400000), lt: thirtyAgo },
        },
        _sum: { netAmount: true },
      }),
      unpaidIds.length
        ? this.prisma.feeInvoice.count({ where: { ...branchFilter, statusId: { in: unpaidIds } } })
        : Promise.resolve(0),
      unpaidIds.length
        ? this.prisma.feeInvoice.count({
            where: { ...branchFilter, statusId: { in: unpaidIds }, createdAt: { lte: thirtyAgo } },
          })
        : Promise.resolve(0),
      this.prisma.feeInvoice.count({ where: branchFilter }),
      this.prisma.feeInvoice.count({ where: { ...branchFilter, createdAt: { lte: thirtyAgo } } }),
    ]);

    const outstanding = Number(outstandingAgg._sum.netAmount ?? 0);
    const prevOutstanding = Number(prevOutstandingAgg._sum.netAmount ?? 0);
    const collected = Number(collectedAgg._sum.netAmount ?? 0);
    const prevCollected = Number(prevCollectedAgg._sum.netAmount ?? 0);

    const result: FeesStatsResponse = {
      outstandingAmount: countWithTrend(outstanding, prevOutstanding),
      collectedLast30Days: countWithTrend(collected, prevCollected),
      overdueCount: countWithTrend(overdueCount, prevOverdueCount),
      invoicesIssued: countWithTrend(invoiceCount, prevInvoiceCount),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async getRevenueTrend(scope: BranchScope): Promise<FeesRevenueTrendResponse> {
    const cacheKey = `fees:revenue-trend:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<FeesRevenueTrendResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const now = new Date();
    const points: Array<{ label: string; value: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      const agg = await this.prisma.feeInvoice.aggregate({
        where: { ...branchFilter, paidAt: { gte: monthStart, lte: monthEnd } },
        _sum: { netAmount: true },
      });
      points.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        value: Number(agg._sum.netAmount ?? 0),
      });
    }

    const current = points[points.length - 1]?.value ?? 0;
    const previous = points[points.length - 2]?.value ?? 0;
    const result: FeesRevenueTrendResponse = {
      points,
      changePercent: countWithTrend(current, previous).changePercent,
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async listTypes(query: ListFeeTypesQuery = {}) {
    const search = query.search?.trim();
    const where = {
      ...(query.isActive !== undefined
        ? { isActive: query.isActive }
        : query.includeInactive
          ? {}
          : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const types = await this.prisma.feeType.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return { data: types };
  }

  private invoiceListWhere(
    query: Pick<
      ListFeeInvoicesQuery,
      | 'branchId'
      | 'studentId'
      | 'statusId'
      | 'feeTypeId'
      | 'billingPeriod'
      | 'search'
      | 'dueFrom'
      | 'dueTo'
    >,
    scope: BranchScope,
  ) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const search = query.search?.trim();
    const dueDate =
      query.dueFrom || query.dueTo
        ? {
            ...(query.dueFrom ? { gte: dueDayStart(query.dueFrom) } : {}),
            ...(query.dueTo ? { lte: dueDayEnd(query.dueTo) } : {}),
          }
        : undefined;

    return {
      effective,
      where: {
        ...prismaBranchFilter(effective),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.statusId ? { statusId: query.statusId } : {}),
        ...(query.feeTypeId
          ? {
              OR: [
                { feeTypeId: query.feeTypeId },
                { lines: { some: { feeTypeId: query.feeTypeId } } },
              ],
            }
          : {}),
        ...(query.billingPeriod ? { billingPeriod: query.billingPeriod } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNo: { contains: search, mode: 'insensitive' as const } },
                { voucherNo: { contains: search, mode: 'insensitive' as const } },
                { student: { fullName: { contains: search, mode: 'insensitive' as const } } },
                { student: { admissionNumber: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
    };
  }

  private async attachPaymentSummaries(
    invoices: Array<{
      id: string;
      branchId: string;
      studentId: string;
      feeTypeId: string;
      invoiceNo?: string | null;
      billingPeriod?: string | null;
      voucherNo?: string | null;
      amount: { toString(): string };
      discount: { toString(): string };
      fine: { toString(): string };
      netAmount: { toString(): string };
      dueDate: Date | null;
      paidAt: Date | null;
      statusId: string;
      remarks: string | null;
      createdAt: Date;
      student?: { id: string; fullName: string };
      lines?: Array<{
        feeTypeId: string;
        label: string;
        amount: { toString(): string } | number;
        sortOrder: number;
      }>;
    }>,
  ): Promise<
    Array<
      Record<string, unknown> & {
        studentId: string;
        billingPeriod: string | null;
        paidAmount: number;
        remainingAmount: number;
        latestPaymentId: string | null;
      }
    >
  > {
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.id);
    const headerTypeIds = invoices.map((i) => i.feeTypeId);
    const lineTypeIds = invoices.flatMap((i) =>
      Array.isArray((i as { lines?: Array<{ feeTypeId: string }> }).lines)
        ? (i as { lines: Array<{ feeTypeId: string }> }).lines.map((line) => line.feeTypeId)
        : [],
    );
    const feeTypeIds = [...new Set([...headerTypeIds, ...lineTypeIds])];
    const statusIds = [...new Set(invoices.map((i) => i.statusId))];

    const [feeTypes, statuses, paidAggs, latestPayments] = await Promise.all([
      this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } }),
      this.prisma.lookupStatus.findMany({ where: { id: { in: statusIds } } }),
      this.prisma.feePayment.groupBy({
        by: ['invoiceId'],
        where: {
          invoiceId: { in: invoiceIds },
          status: { in: ['succeeded', 'completed'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.feePayment.findMany({
        where: {
          invoiceId: { in: invoiceIds },
          status: { in: ['succeeded', 'completed'] },
        },
        orderBy: { paidAt: 'desc' },
        distinct: ['invoiceId'],
        select: { id: true, invoiceId: true },
      }),
    ]);

    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));
    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const paidMap = new Map(
      paidAggs.map((a) => [a.invoiceId, this.roundMoney(Number(a._sum.amount ?? 0))]),
    );
    const latestMap = new Map(latestPayments.map((p) => [p.invoiceId, p.id]));

    return invoices.map((inv) => {
      const paidAmount = paidMap.get(inv.id) ?? 0;
      const netAmount = this.roundMoney(Number(inv.netAmount));
      const base = this.toResponse(inv, feeTypeMap, statusMap);
      return {
        ...base,
        studentId: inv.studentId,
        billingPeriod: base.billingPeriod,
        paidAmount,
        remainingAmount: Math.max(0, this.roundMoney(netAmount - paidAmount)),
        latestPaymentId: latestMap.get(inv.id) ?? null,
      };
    });
  }

  async findAll(query: ListFeeInvoicesQuery, scope: BranchScope): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { where } = this.invoiceListWhere(query, scope);

    const [invoices, total] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where,
        include: {
          student: { select: { id: true, fullName: true } },
          lines: { orderBy: { sortOrder: 'asc' as const } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ billingPeriod: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.feeInvoice.count({ where }),
    ]);

    const data = await this.attachPaymentSummaries(invoices);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  /** YYYY-MM for the current calendar month and the month before. */
  private currentAndPreviousBillingPeriods(now = new Date()): [string, string] {
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const current = `${y}-${String(m + 1).padStart(2, '0')}`;
    const prev = new Date(y, m - 1, 1);
    const previous = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    return [current, previous];
  }

  private previewInvoicesForStudent<T extends { billingPeriod?: unknown }>(
    studentInvoices: T[],
    previewPeriods: Set<string>,
  ): T[] {
    const periodOf = (inv: T): string | null =>
      typeof inv.billingPeriod === 'string' && inv.billingPeriod.length > 0
        ? inv.billingPeriod
        : null;

    const inWindow = studentInvoices.filter((inv) => {
      const period = periodOf(inv);
      return period != null && previewPeriods.has(period);
    });
    if (inWindow.length > 0) return inWindow;

    // Fallback when the student has no rows in the current/previous months:
    // show invoices from their two most recent billing periods.
    const periods = [
      ...new Set(studentInvoices.map(periodOf).filter((p): p is string => p != null)),
    ]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 2);
    if (periods.length === 0) return [];
    const fallback = new Set(periods);
    return studentInvoices.filter((inv) => {
      const period = periodOf(inv);
      return period != null && fallback.has(period);
    });
  }

  async findAllByStudent(
    query: ListFeeInvoicesByStudentQuery,
    scope: BranchScope,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { where } = this.invoiceListWhere(query, scope);
    const [currentPeriod, previousPeriod] = this.currentAndPreviousBillingPeriods();
    const previewPeriods = new Set([currentPeriod, previousPeriod]);

    const groups = await this.prisma.feeInvoice.groupBy({
      by: ['studentId'],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
    });

    groups.sort(
      (a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0),
    );

    const total = groups.length;
    const skip = (query.page - 1) * query.limit;
    const pageGroups = groups.slice(skip, skip + query.limit);
    const studentIds = pageGroups.map((g) => g.studentId);

    if (studentIds.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit) || 1,
        },
      };
    }

    const [students, invoices] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, fullName: true, admissionNumber: true },
      }),
      this.prisma.feeInvoice.findMany({
        where: { ...where, studentId: { in: studentIds } },
        include: {
          student: { select: { id: true, fullName: true } },
          lines: { orderBy: { sortOrder: 'asc' as const } },
        },
        orderBy: [{ billingPeriod: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const mapped = await this.attachPaymentSummaries(invoices);

    const byStudent = new Map<string, typeof mapped>();
    for (const inv of mapped) {
      const sid = String(inv.studentId);
      const list = byStudent.get(sid) ?? [];
      list.push(inv);
      byStudent.set(sid, list);
    }

    const data = pageGroups.map((g) => {
      const studentInvoices = byStudent.get(g.studentId) ?? [];
      const openBalance = this.roundMoney(
        studentInvoices.reduce((sum, inv) => sum + Number(inv.remainingAmount ?? 0), 0),
      );
      const student = studentMap.get(g.studentId);
      return {
        student: student
          ? {
              id: student.id,
              fullName: student.fullName,
              admissionNumber: student.admissionNumber,
            }
          : { id: g.studentId, fullName: '—', admissionNumber: null },
        totals: {
          invoiceCount: g._count._all,
          openBalance,
        },
        previewPeriods: [currentPeriod, previousPeriod],
        preview: this.previewInvoicesForStudent(studentInvoices, previewPeriods),
      };
    });

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async create(input: CreateFeeInvoiceInput, user: AuthUser) {
    const lineSpecs = await this.resolveInvoiceLineSpecs(input);
    const headerFeeTypeId = lineSpecs[0]!.feeTypeId;
    const amount = this.roundMoney(lineSpecs.reduce((sum, line) => sum + line.amount, 0));

    const [student, feeTypes, pendingStatus] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
        select: {
          id: true,
          admissionNumber: true,
          rollNumber: true,
          monthlyFeeDiscount: true,
          monthlyFeeAmount: true,
          monthlyFeeWaived: true,
          annualChargeMode: true,
          annualDeferredUntil: true,
          annualInstallmentCount: true,
        },
      }),
      this.prisma.feeType.findMany({
        where: { id: { in: [...new Set(lineSpecs.map((line) => line.feeTypeId))] } },
      }),
      this.prisma.lookupStatus.findFirst({
        where: { code: 'pending', category: { code: 'fee_status' } },
      }),
    ]);

    if (!student) throw new BadRequestException('Invalid student for this branch');
    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');
    const feeTypeMap = new Map(feeTypes.map((row) => [row.id, row]));
    const feeType = feeTypeMap.get(headerFeeTypeId);
    if (!feeType) throw new BadRequestException('Invalid fee type');
    for (const line of lineSpecs) {
      if (!feeTypeMap.has(line.feeTypeId)) throw new BadRequestException('Invalid fee type');
    }

    const siblingDiscount = await this.computeSiblingDiscount(input.studentId, amount);
    const monthlyLine = lineSpecs.find((line) => feeTypeMap.get(line.feeTypeId)?.code === 'monthly');
    const monthlyRecurring = this.monthlyFeeDiscountForType(
      monthlyLine ? 'monthly' : feeType.code,
      Number(student.monthlyFeeDiscount),
      monthlyLine?.amount ?? amount,
    );
    const { discount, remarks } = this.composeInvoiceDiscount({
      amount,
      extraDiscount: input.discount ?? 0,
      siblingDiscount,
      monthlyRecurring,
      existingRemarks: input.remarks,
    });
    const waivedMonthly = Boolean(monthlyLine) && student.monthlyFeeWaived;
    const fine = waivedMonthly ? 0 : (input.fine ?? 0);
    const effectiveDiscount = waivedMonthly ? amount : discount;
    const netAmount = this.roundMoney(amount - effectiveDiscount + fine);
    const waivedStatus = waivedMonthly
      ? await this.prisma.lookupStatus.findFirst({
          where: { code: 'waived', category: { code: 'fee_status' } },
        })
      : null;

    const billingPeriod = input.billingPeriod ?? currentBillingPeriod();
    const voucherNo =
      input.voucherNo ??
      (await this.allocateMonthlyVoucherNo({
        branchId: input.branchId,
        studentId: input.studentId,
        billingPeriod,
      }));

    const invoiceNo = await this.nextDocumentNumber(input.branchId, 'INV');
    const invoice = await this.prisma.feeInvoice.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        feeTypeId: headerFeeTypeId,
        invoiceNo,
        billingPeriod,
        voucherNo,
        amount,
        discount: effectiveDiscount,
        fine,
        netAmount,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        statusId: waivedMonthly && waivedStatus ? waivedStatus.id : pendingStatus.id,
        remarks: waivedMonthly
          ? [remarks, 'Monthly fee waived'].filter(Boolean).join(' · ')
          : remarks,
        createdById: user.id,
        lines: {
          create: lineSpecs.map((line, index) => ({
            feeTypeId: line.feeTypeId,
            label: line.label || feeTypeMap.get(line.feeTypeId)?.name || 'Fee',
            amount: line.amount,
            sortOrder: line.sortOrder ?? index,
          })),
        },
      },
      include: {
        student: { select: { id: true, fullName: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.applyLateFeesToOverdue(selectedBranchScope([input.branchId]));

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoice.created',
      entityType: 'FeeInvoice',
      entityId: invoice.id,
      newValue: invoice,
    });

    const statusMap = new Map([[pendingStatus.id, pendingStatus]]);
    return {
      ...this.toResponse(invoice, feeTypeMap, statusMap),
      paidAmount: 0,
      remainingAmount: this.roundMoney(netAmount),
    };
  }

  async updateInvoice(
    id: string,
    input: UpdateFeeInvoiceInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
        student: { select: { id: true, fullName: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const nextLines = input.lines?.length
      ? await this.resolveInvoiceLineSpecs({
          feeTypeId: input.lines[0]?.feeTypeId,
          amount: input.lines[0]?.amount,
          lines: input.lines,
        })
      : null;
    const amount =
      nextLines
        ? this.roundMoney(nextLines.reduce((sum, line) => sum + line.amount, 0))
        : input.amount !== undefined
          ? this.roundMoney(input.amount)
          : this.roundMoney(Number(invoice.amount));
    const discount =
      input.discount !== undefined
        ? Math.max(0, this.roundMoney(input.discount))
        : this.roundMoney(Number(invoice.discount));
    const fine =
      input.fine !== undefined
        ? Math.max(0, this.roundMoney(input.fine))
        : this.roundMoney(Number(invoice.fine));
    const netAmount = this.roundMoney(amount - discount + fine);
    const paidTotal = this.getPaidAmount(invoice);

    if (netAmount < paidTotal) {
      throw new BadRequestException(
        `Net amount (${netAmount}) cannot be less than already paid (${paidTotal}). Reverse or adjust payments first.`,
      );
    }

    const previousValue = {
      amount: Number(invoice.amount),
      discount: Number(invoice.discount),
      fine: Number(invoice.fine),
      netAmount: Number(invoice.netAmount),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      billingPeriod: invoice.billingPeriod ?? null,
      voucherNo: invoice.voucherNo ?? null,
      remarks: invoice.remarks,
    };

    await this.prisma.$transaction(async (tx) => {
      if (nextLines) {
        await tx.feeInvoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.feeInvoiceLine.createMany({
          data: nextLines.map((line, index) => ({
            invoiceId: id,
            feeTypeId: line.feeTypeId,
            label: line.label,
            amount: line.amount,
            sortOrder: line.sortOrder ?? index,
          })),
        });
      } else if (input.amount !== undefined && invoice.lines.length <= 1) {
        if (invoice.lines[0]) {
          await tx.feeInvoiceLine.update({
            where: { id: invoice.lines[0].id },
            data: { amount },
          });
        } else {
          const headerType = await tx.feeType.findUnique({ where: { id: invoice.feeTypeId } });
          await tx.feeInvoiceLine.create({
            data: {
              invoiceId: id,
              feeTypeId: invoice.feeTypeId,
              label: headerType?.name ?? 'Fee',
              amount,
              sortOrder: 0,
            },
          });
        }
      }

      await tx.feeInvoice.update({
        where: { id },
        data: {
          amount,
          discount,
          fine,
          netAmount,
          ...(nextLines ? { feeTypeId: nextLines[0]!.feeTypeId } : {}),
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          ...(input.billingPeriod !== undefined
            ? { billingPeriod: input.billingPeriod || null }
            : {}),
          ...(input.voucherNo !== undefined ? { voucherNo: input.voucherNo || null } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks || null } : {}),
        },
      });
    });

    const updated = await this.syncInvoiceAfterPayment(id);
    const [feeType, status] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: updated.feeTypeId } }),
      this.prisma.lookupStatus.findUnique({ where: { id: updated.statusId } }),
    ]);
    const feeTypeMap = feeType ? new Map([[feeType.id, feeType]]) : new Map();
    const statusMap = status ? new Map([[status.id, status]]) : new Map();

    // Propagate discount and amount to later unpaid months.
    let cascadedCount = 0;
    if (input.discount !== undefined) {
      cascadedCount += await this.cascadeDiscountToFutureInvoices({
        sourceInvoiceId: id,
        studentId: invoice.studentId,
        feeTypeId: invoice.feeTypeId,
        billingPeriod: updated.billingPeriod ?? invoice.billingPeriod,
        dueDate: updated.dueDate ?? invoice.dueDate,
        discount,
        scope,
      });

      // Keep recurring student discount in sync for monthly fee types.
      if (feeType?.code === 'monthly') {
        await this.prisma.student.update({
          where: { id: invoice.studentId },
          data: { monthlyFeeDiscount: discount },
        });
      }
    }
    if (input.amount !== undefined || nextLines) {
      cascadedCount += await this.cascadeAmountToFutureInvoices({
        sourceInvoiceId: id,
        studentId: invoice.studentId,
        feeTypeId: nextLines?.[0]?.feeTypeId ?? invoice.feeTypeId,
        billingPeriod: updated.billingPeriod ?? invoice.billingPeriod,
        dueDate: updated.dueDate ?? invoice.dueDate,
        amount,
        lines: nextLines,
        scope,
      });
    }

    const newValue = {
      amount,
      discount,
      fine,
      netAmount,
      dueDate: updated.dueDate?.toISOString() ?? null,
      billingPeriod: updated.billingPeriod ?? null,
      voucherNo: updated.voucherNo ?? null,
      remarks: updated.remarks,
      statusId: updated.statusId,
      cascadedCount,
    };

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoice.updated',
      entityType: 'FeeInvoice',
      entityId: id,
      previousValue,
      newValue,
    });

    return {
      ...this.toResponse(updated, feeTypeMap, statusMap),
      ...this.paymentSummary(updated),
      cascadedCount,
    };
  }

  /**
   * Apply the same discount to later invoices for this student + fee type.
   * Skips rows where net would fall below already-paid amounts.
   */
  private async cascadeDiscountToFutureInvoices(opts: {
    sourceInvoiceId: string;
    studentId: string;
    feeTypeId: string;
    billingPeriod: string | null;
    dueDate: Date | null;
    discount: number;
    scope: BranchScope;
  }): Promise<number> {
    const period = opts.billingPeriod?.trim() || null;
    const futureWhere = period
      ? { billingPeriod: { gt: period } }
      : opts.dueDate
        ? { dueDate: { gt: opts.dueDate } }
        : null;
    if (!futureWhere) return 0;

    const futures = await this.prisma.feeInvoice.findMany({
      where: {
        id: { not: opts.sourceInvoiceId },
        studentId: opts.studentId,
        feeTypeId: opts.feeTypeId,
        ...prismaBranchFilter(opts.scope),
        ...futureWhere,
      },
      include: {
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
      },
      orderBy: [{ billingPeriod: 'asc' }, { dueDate: 'asc' }],
    });

    let cascaded = 0;
    for (const inv of futures) {
      const amount = this.roundMoney(Number(inv.amount));
      const fine = this.roundMoney(Number(inv.fine));
      const discount = Math.max(0, Math.min(opts.discount, amount));
      const netAmount = this.roundMoney(amount - discount + fine);
      const paidTotal = this.getPaidAmount(inv);
      if (netAmount < paidTotal) continue;
      if (
        this.roundMoney(Number(inv.discount)) === discount &&
        this.roundMoney(Number(inv.netAmount)) === netAmount
      ) {
        continue;
      }

      await this.prisma.feeInvoice.update({
        where: { id: inv.id },
        data: { discount, netAmount },
      });
      await this.syncInvoiceAfterPayment(inv.id);
      cascaded += 1;
    }
    return cascaded;
  }

  /**
   * Apply amount / line amount changes to later unpaid invoices for this student.
   * Skips paid and partially paid rows. Matches lines by fee type.
   */
  private async cascadeAmountToFutureInvoices(opts: {
    sourceInvoiceId: string;
    studentId: string;
    feeTypeId: string;
    billingPeriod: string | null;
    dueDate: Date | null;
    amount: number;
    lines: Array<{ feeTypeId: string; label: string; amount: number; sortOrder?: number }> | null;
    scope: BranchScope;
  }): Promise<number> {
    const period = opts.billingPeriod?.trim() || null;
    const futureWhere = period
      ? { billingPeriod: { gt: period } }
      : opts.dueDate
        ? { dueDate: { gt: opts.dueDate } }
        : null;
    if (!futureWhere) return 0;

    const futures = await this.prisma.feeInvoice.findMany({
      where: {
        id: { not: opts.sourceInvoiceId },
        studentId: opts.studentId,
        paidAt: null,
        ...prismaBranchFilter(opts.scope),
        ...futureWhere,
      },
      include: {
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ billingPeriod: 'asc' }, { dueDate: 'asc' }],
    });

    let cascaded = 0;
    for (const inv of futures) {
      const paidTotal = this.getPaidAmount(inv);
      if (paidTotal > 0) continue;

      const discount = this.roundMoney(Number(inv.discount));
      const fine = this.roundMoney(Number(inv.fine));
      const sourceByType = new Map((opts.lines ?? []).map((line) => [line.feeTypeId, line]));

      if (sourceByType.size > 0 && inv.lines.length > 0) {
        let changed = false;
        const nextLines = inv.lines.map((line) => {
          const source = sourceByType.get(line.feeTypeId);
          if (!source) return { ...line, amount: this.roundMoney(Number(line.amount)) };
          const nextAmount = this.roundMoney(source.amount);
          if (nextAmount !== this.roundMoney(Number(line.amount))) changed = true;
          return { ...line, amount: nextAmount, label: source.label || line.label };
        });
        if (!changed) continue;
        const amount = this.roundMoney(nextLines.reduce((sum, line) => sum + line.amount, 0));
        const netAmount = this.roundMoney(amount - discount + fine);
        await this.prisma.$transaction(async (tx) => {
          for (const line of nextLines) {
            await tx.feeInvoiceLine.update({
              where: { id: line.id },
              data: { amount: line.amount, label: line.label },
            });
          }
          await tx.feeInvoice.update({
            where: { id: inv.id },
            data: { amount, netAmount },
          });
        });
        await this.syncInvoiceAfterPayment(inv.id);
        cascaded += 1;
        continue;
      }

      const headerMatches =
        inv.feeTypeId === opts.feeTypeId ||
        inv.lines.some((line) => line.feeTypeId === opts.feeTypeId);
      if (!headerMatches && inv.lines.length > 1) continue;

      const amount = this.roundMoney(opts.amount);
      const netAmount = this.roundMoney(amount - discount + fine);
      if (
        this.roundMoney(Number(inv.amount)) === amount &&
        this.roundMoney(Number(inv.netAmount)) === netAmount
      ) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        if (inv.lines.length === 1) {
          await tx.feeInvoiceLine.update({
            where: { id: inv.lines[0]!.id },
            data: { amount },
          });
        } else if (inv.lines.length === 0) {
          const headerType = await tx.feeType.findUnique({ where: { id: inv.feeTypeId } });
          await tx.feeInvoiceLine.create({
            data: {
              invoiceId: inv.id,
              feeTypeId: inv.feeTypeId,
              label: headerType?.name ?? 'Fee',
              amount,
              sortOrder: 0,
            },
          });
        } else {
          const match = inv.lines.find((line) => line.feeTypeId === opts.feeTypeId);
          if (match) {
            await tx.feeInvoiceLine.update({
              where: { id: match.id },
              data: { amount },
            });
          }
        }
        await tx.feeInvoice.update({
          where: { id: inv.id },
          data: { amount, netAmount },
        });
      });
      await this.syncInvoiceAfterPayment(inv.id);
      cascaded += 1;
    }
    return cascaded;
  }

  async recordPayment(id: string, input: RecordPaymentInput, user: AuthUser, scope: BranchScope) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const remaining = this.getRemainingAmount(invoice);
    if (remaining <= 0) throw new BadRequestException('Invoice is already fully paid');

    return this.recordFeePayment(
      id,
      {
        amount: input.amount ?? remaining,
        method: input.method ?? 'other',
        paidAt: input.paidAt,
        providerRef: input.providerRef,
        receipt: input.receipt,
      },
      user,
      scope,
      { provider: 'manual' },
    );
  }

  async preparePaymentReceiptUpload(
    invoiceId: string,
    input: PrepareFeePaymentReceiptUploadInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, ...prismaBranchFilter(scope) },
      select: { id: true, branchId: true, studentId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.documents.prepareUpload(
      {
        fileName: input.fileName,
        branchId: invoice.branchId,
        studentId: invoice.studentId,
      },
      user,
    );
  }

  async recordFeePayment(
    id: string,
    input: RecordFeePaymentInput,
    user: AuthUser,
    scope: BranchScope,
    options?: { provider?: string; providerRef?: string; status?: string; skipAudit?: boolean },
  ) {
    await this.applyLateFeesToOverdue(scope);

    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        student: { select: { id: true, fullName: true } },
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const currentStatus = await this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } });
    if (currentStatus?.code === 'waived') {
      throw new BadRequestException('Cannot record payment on waived invoice');
    }

    const remaining = this.getRemainingAmount(invoice);
    const amount = this.roundMoney(input.amount);
    if (amount > remaining) {
      throw new BadRequestException(`Payment amount exceeds remaining balance (${remaining})`);
    }

    const paidAt = input.paidAt ? parseCalendarDate(input.paidAt) : new Date();
    const status = options?.status ?? 'succeeded';
    const receiptNo = await this.nextDocumentNumber(invoice.branchId, 'RCP');
    const providerRef =
      (input.providerRef?.trim() || options?.providerRef?.trim() || undefined) ?? undefined;

    const payment = await this.prisma.feePayment.create({
      data: {
        invoiceId: id,
        branchId: invoice.branchId,
        receiptNo,
        amount,
        method: input.method,
        provider: options?.provider ?? 'manual',
        providerRef,
        status,
        paidAt: status === 'succeeded' ? paidAt : null,
        recordedById: user.id,
        meta: input.receipt
          ? {
              receipt: {
                storagePath: input.receipt.storagePath,
                fileName: input.receipt.fileName,
                mimeType: input.receipt.mimeType ?? null,
                sizeBytes: input.receipt.sizeBytes ?? null,
              },
            }
          : undefined,
      },
    });

    const updated = await this.syncInvoiceAfterPayment(id);

    if (status === 'succeeded') {
      await this.accountingPosting.postFeePayment(
        payment.id,
        invoice.branchId,
        amount,
        user.id,
      );
    }

    if (!options?.skipAudit) {
      await this.audit.log({
        userId: user.id,
        action: status === 'succeeded' ? 'fee_invoice.paid' : 'fee_payment.created',
        entityType: 'FeePayment',
        entityId: payment.id,
        previousValue: invoice,
        newValue: { payment, invoice: updated },
      });
    }

    const [feeType, statusLookup] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: updated.feeTypeId } }),
      this.prisma.lookupStatus.findUnique({ where: { id: updated.statusId } }),
    ]);
    const feeTypeMap = feeType ? new Map([[feeType.id, feeType]]) : new Map();
    const statusMap = statusLookup ? new Map([[statusLookup.id, statusLookup]]) : new Map();
    return {
      payment: {
        id: payment.id,
        receiptNo: payment.receiptNo,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
      invoice: this.toResponse(updated, feeTypeMap, statusMap),
    };
  }

  async syncInvoiceAfterPayment(invoiceId: string) {
    const invoice = await this.prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidTotal = this.getPaidAmount(invoice);
    const netAmount = this.roundMoney(Number(invoice.netAmount));
    const statusCodes = await this.getFeeStatusMap();
    const currentStatus = await this.prisma.lookupStatus.findUnique({
      where: { id: invoice.statusId },
      select: { code: true },
    });

    if (currentStatus?.code === 'waived') {
      const latestPayment = invoice.payments
        .filter((p) => p.paidAt)
        .sort((a, b) => (b.paidAt!.getTime() - a.paidAt!.getTime()))[0];
      return this.prisma.feeInvoice.update({
        where: { id: invoiceId },
        data: { statusId: invoice.statusId, paidAt: latestPayment?.paidAt ?? null },
        include: {
          student: { select: { id: true, fullName: true } },
          payments: { where: { status: { in: ['succeeded', 'completed'] } } },
        },
      });
    }

    let statusCode: string;
    let paidAt: Date | null = null;

    if (paidTotal >= netAmount) {
      statusCode = 'paid';
      const latestPayment = invoice.payments
        .filter((p) => p.paidAt)
        .sort((a, b) => (b.paidAt!.getTime() - a.paidAt!.getTime()));
      paidAt = latestPayment[0]?.paidAt ?? new Date();
    } else if (paidTotal > 0) {
      statusCode = 'partial';
    } else if (invoice.dueDate && invoice.dueDate < new Date()) {
      statusCode = 'overdue';
    } else {
      statusCode = 'pending';
    }

    const statusId = statusCodes.get(statusCode);
    if (!statusId) throw new BadRequestException(`Fee status lookup not configured: ${statusCode}`);

    return this.prisma.feeInvoice.update({
      where: { id: invoiceId },
      data: { statusId, paidAt },
      include: {
        student: { select: { id: true, fullName: true } },
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
      },
    });
  }

  async getInvoiceRemainingAmount(id: string, scope: BranchScope): Promise<number> {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.getRemainingAmount(invoice);
  }

  private async allocateMonthlyVoucherNo(opts: {
    branchId: string;
    studentId: string;
    billingPeriod: string | null;
  }): Promise<string | null> {
    if (!opts.billingPeriod) return null;

    const existingInvoice = await this.prisma.feeInvoice.findFirst({
      where: {
        branchId: opts.branchId,
        studentId: opts.studentId,
        billingPeriod: opts.billingPeriod,
        voucherNo: { not: null },
      },
      select: { voucherNo: true },
    });
    if (existingInvoice?.voucherNo) return existingInvoice.voucherNo;

    const existingChallan = await this.prisma.feeChallan.findUnique({
      where: {
        branchId_studentId_billingPeriod: {
          branchId: opts.branchId,
          studentId: opts.studentId,
          billingPeriod: opts.billingPeriod,
        },
      },
      select: { challanNo: true },
    });
    if (existingChallan?.challanNo) return existingChallan.challanNo;

    const [branch, student] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: opts.branchId },
        select: { code: true },
      }),
      this.prisma.student.findUnique({
        where: { id: opts.studentId },
        select: { admissionNumber: true, rollNumber: true },
      }),
    ]);

    return formatMonthlyVoucherNo({
      branchCode: branch?.code ?? 'BR',
      admissionNumber: student?.admissionNumber ?? null,
      rollNumber: student?.rollNumber ?? null,
      studentId: opts.studentId,
      billingPeriod: opts.billingPeriod,
    });
  }

  private async allocateMonthlyVoucherNos(opts: {
    branchId: string;
    billingPeriod: string | null;
    branchCode: string;
    students: Array<{ id: string; admissionNumber: string | null; rollNumber: string | null }>;
  }): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    if (!opts.billingPeriod || opts.students.length === 0) {
      for (const student of opts.students) result.set(student.id, null);
      return result;
    }

    const studentIds = opts.students.map((student) => student.id);
    const [invoices, challans] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where: {
          branchId: opts.branchId,
          studentId: { in: studentIds },
          billingPeriod: opts.billingPeriod,
          voucherNo: { not: null },
        },
        select: { studentId: true, voucherNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.feeChallan.findMany({
        where: {
          branchId: opts.branchId,
          studentId: { in: studentIds },
          billingPeriod: opts.billingPeriod,
          challanNo: { not: null },
        },
        select: { studentId: true, challanNo: true },
      }),
    ]);

    const voucherFromInvoice = new Map<string, string>();
    for (const row of invoices) {
      if (row.voucherNo && !voucherFromInvoice.has(row.studentId)) {
        voucherFromInvoice.set(row.studentId, row.voucherNo);
      }
    }
    const challanByStudent = new Map(
      challans
        .filter((row) => Boolean(row.challanNo))
        .map((row) => [row.studentId, row.challanNo as string]),
    );

    for (const student of opts.students) {
      result.set(
        student.id,
        voucherFromInvoice.get(student.id) ??
          challanByStudent.get(student.id) ??
          formatMonthlyVoucherNo({
            branchCode: opts.branchCode,
            admissionNumber: student.admissionNumber,
            rollNumber: student.rollNumber,
            studentId: student.id,
            billingPeriod: opts.billingPeriod,
          }),
      );
    }
    return result;
  }

  private async resolveGenerateAmount(opts: {
    student: {
      id: string;
      monthlyFeeAmount: { toString(): string } | number | null;
      monthlyFeeWaived: boolean;
      annualChargeMode: string;
      annualDeferredUntil: Date | null;
      annualInstallmentCount: number;
    };
    feeType: { id: string; code: string };
    requestedAmount: number;
    billingPeriod: string;
  }): Promise<{ amount: number; skip: boolean; waived: boolean; reason?: string }> {
    if (opts.feeType.code === 'monthly') {
      const listed =
        opts.student.monthlyFeeAmount != null
          ? this.roundMoney(Number(opts.student.monthlyFeeAmount))
          : opts.requestedAmount;
      if (opts.student.monthlyFeeWaived) {
        return { amount: listed, skip: false, waived: true, reason: 'Monthly fee waived' };
      }
      return { amount: listed, skip: false, waived: false };
    }

    if (opts.feeType.code !== 'annual') {
      return { amount: opts.requestedAmount, skip: false, waived: false };
    }

    const mode = opts.student.annualChargeMode || 'full';
    if (mode === 'waived') {
      await this.waiveUnpaidAnnualInvoices(opts.student.id, opts.feeType.id);
      return { amount: 0, skip: true, waived: true, reason: 'Annual charges waived' };
    }
    if (mode === 'deferred' && opts.student.annualDeferredUntil) {
      const until = opts.student.annualDeferredUntil;
      if (new Date() < until) {
        return {
          amount: 0,
          skip: true,
          waived: false,
          reason: `Annual charges deferred until ${until.toISOString().slice(0, 10)}`,
        };
      }
    }
    if (mode === 'installments') {
      const slice = await this.annualInstallmentAmount(
        opts.student.id,
        opts.feeType.id,
        opts.requestedAmount,
        opts.billingPeriod,
        opts.student.annualInstallmentCount || 12,
      );
      if (slice <= 0) {
        return { amount: 0, skip: true, waived: false, reason: 'Annual charges already billed this session' };
      }
      return { amount: slice, skip: false, waived: false };
    }
    return { amount: opts.requestedAmount, skip: false, waived: false };
  }

  private async annualInstallmentAmount(
    studentId: string,
    feeTypeId: string,
    annualAmount: number,
    billingPeriod: string,
    installmentCount: number,
  ): Promise<number> {
    const sessionLabel = this.sessionLabelFromPeriod(billingPeriod);
    const periods = this.sessionPeriods(sessionLabel);
    const billed = await this.prisma.feeInvoice.aggregate({
      where: {
        studentId,
        feeTypeId,
        billingPeriod: { in: periods },
      },
      _sum: { amount: true },
    });
    const billedSoFar = this.roundMoney(Number(billed._sum.amount ?? 0));
    const remaining = this.roundMoney(annualAmount - billedSoFar);
    if (remaining <= 0) return 0;
    const n = Math.max(1, installmentCount);
    const slice = this.roundMoney(annualAmount / n);
    return Math.min(slice, remaining);
  }

  private async waiveUnpaidAnnualInvoices(studentId: string, feeTypeId: string) {
    const waivedStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'waived', category: { code: 'fee_status' } },
    });
    if (!waivedStatus) return;
    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId, feeTypeId },
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
    });
    for (const invoice of invoices) {
      if (invoice.statusId === waivedStatus.id) continue;
      const paid = this.getPaidAmount(invoice);
      if (paid > 0 && paid >= this.roundMoney(Number(invoice.netAmount))) continue;
      const amount = this.roundMoney(Number(invoice.amount));
      await this.prisma.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          discount: this.roundMoney(amount - paid),
          fine: 0,
          netAmount: paid,
          statusId: waivedStatus.id,
          paidAt: null,
        },
      });
    }
  }

  async incrementFeeRates(
    input: IncrementFeeRatesInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const feeType = await this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } });
    if (!feeType) throw new BadRequestException('Invalid fee type');
    if (input.scope === 'all_campuses' && scope.kind !== 'all') {
      throw new BadRequestException('All campuses increment requires institution-wide access');
    }

    const { structureIds, studentIds } = await this.resolveIncrementTargets(input, scope);
    const dryRun = input.dryRun !== false;

    const structures = structureIds.length
      ? await this.prisma.feeStructure.findMany({ where: { id: { in: structureIds } } })
      : [];
    const overrideStudents =
      feeType.code === 'monthly' && studentIds.length
        ? await this.prisma.student.findMany({
            where: {
              id: { in: studentIds },
              deletedAt: null,
              monthlyFeeAmount: { not: null },
            },
            select: { id: true, fullName: true, monthlyFeeAmount: true },
          })
        : [];

    const structureChanges = structures.map((row) => {
      const from = this.roundMoney(Number(row.amount));
      return { id: row.id, from, to: applyFeeIncrement(from, input.mode, input.value) };
    });
    const overrideChanges = overrideStudents.map((row) => {
      const from = this.roundMoney(Number(row.monthlyFeeAmount));
      return {
        id: row.id,
        name: row.fullName,
        from,
        to: applyFeeIncrement(from, input.mode, input.value),
      };
    });

    let oneStudentOverride: { id: string; from: number; to: number } | null = null;
    if (input.scope === 'student' && input.studentId && feeType.code === 'monthly') {
      const student = await this.prisma.student.findFirst({
        where: { id: input.studentId, deletedAt: null, ...prismaBranchFilter(scope) },
        select: { id: true, monthlyFeeAmount: true, programId: true, batchId: true, branchId: true },
      });
      if (!student) throw new NotFoundException('Student not found');
      const structuresForStudent = await this.loadFeeStructuresForBulk({
        branchId: student.branchId,
        feeTypeId: feeType.id,
      });
      const matched = this.matchFeeStructureForStudent(structuresForStudent, student);
      const current =
        student.monthlyFeeAmount != null
          ? this.roundMoney(Number(student.monthlyFeeAmount))
          : matched
            ? this.roundMoney(Number(matched.amount))
            : 0;
      oneStudentOverride = {
        id: student.id,
        from: current,
        to: applyFeeIncrement(current, input.mode, input.value),
      };
    }

    const unpaidStatuses = await this.prisma.lookupStatus.findMany({
      where: {
        category: { code: 'fee_status' },
        code: { in: ['pending', 'partial', 'overdue'] },
      },
      select: { id: true },
    });
    const unpaidStatusIds = unpaidStatuses.map((s) => s.id);
    const invoices =
      studentIds.length && unpaidStatusIds.length
        ? await this.prisma.feeInvoice.findMany({
            where: {
              studentId: { in: studentIds },
              feeTypeId: feeType.id,
              statusId: { in: unpaidStatusIds },
              OR: [
                { billingPeriod: { gte: input.effectiveFrom } },
                { billingPeriod: null, dueDate: { gte: new Date(`${input.effectiveFrom}-01T00:00:00.000Z`) } },
              ],
            },
            include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
          })
        : [];

    const invoiceChanges: Array<{ id: string; from: number; to: number }> = [];
    for (const invoice of invoices) {
      const from = this.roundMoney(Number(invoice.amount));
      const to = applyFeeIncrement(from, input.mode, input.value);
      const discount = this.roundMoney(Number(invoice.discount));
      const fine = this.roundMoney(Number(invoice.fine));
      const netAmount = this.roundMoney(to - Math.min(discount, to) + fine);
      const paid = this.getPaidAmount(invoice);
      if (netAmount < paid) continue;
      invoiceChanges.push({ id: invoice.id, from, to });
    }

    const summary = {
      dryRun,
      feeType: { id: feeType.id, name: feeType.name, code: feeType.code },
      structures: structureChanges.length,
      studentOverrides: overrideChanges.length + (oneStudentOverride ? 1 : 0),
      unpaidInvoices: invoiceChanges.length,
      samples: {
        structures: structureChanges.slice(0, 5),
        invoices: invoiceChanges.slice(0, 5),
        overrides: oneStudentOverride
          ? [oneStudentOverride]
          : overrideChanges.slice(0, 5),
      },
    };

    if (dryRun) return summary;

    await this.prisma.$transaction(async (tx) => {
      for (const change of structureChanges) {
        await tx.feeStructure.update({ where: { id: change.id }, data: { amount: change.to } });
      }
      for (const change of overrideChanges) {
        await tx.student.update({
          where: { id: change.id },
          data: { monthlyFeeAmount: change.to },
        });
      }
      if (oneStudentOverride) {
        await tx.student.update({
          where: { id: oneStudentOverride.id },
          data: { monthlyFeeAmount: oneStudentOverride.to },
        });
      }
      for (const change of invoiceChanges) {
        const invoice = invoices.find((row) => row.id === change.id);
        if (!invoice) continue;
        const discount = Math.min(this.roundMoney(Number(invoice.discount)), change.to);
        const fine = this.roundMoney(Number(invoice.fine));
        const netAmount = this.roundMoney(change.to - discount + fine);
        await tx.feeInvoice.update({
          where: { id: change.id },
          data: { amount: change.to, discount, netAmount },
        });
      }
    });

    for (const change of invoiceChanges) {
      await this.syncInvoiceAfterPayment(change.id);
    }

    await this.audit.log({
      userId: user.id,
      action: 'fee_rates.incremented',
      entityType: 'FeeStructure',
      entityId: input.feeTypeId,
      newValue: { ...summary, dryRun: false, input },
    });

    return { ...summary, dryRun: false };
  }

  private async resolveIncrementTargets(
    input: IncrementFeeRatesInput,
    scope: BranchScope,
  ): Promise<{ structureIds: string[]; studentIds: string[] }> {
    const branchFilter = prismaBranchFilter(
      input.scope === 'all_campuses' ? { kind: 'all' } : scope,
    );

    if (input.scope === 'student' && input.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: input.studentId, deletedAt: null, ...prismaBranchFilter(scope) },
        select: { id: true },
      });
      if (!student) throw new NotFoundException('Student not found');
      return { structureIds: [], studentIds: [student.id] };
    }

    let programIds: string[] | undefined;
    if (input.scope === 'program' && input.programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: input.programId, deletedAt: null },
        select: { id: true, name: true, code: true, branchId: true },
      });
      if (!program) throw new NotFoundException('Program not found');
      programIds = [program.id];
    }

    const structureWhere = {
      feeTypeId: input.feeTypeId,
      isActive: true,
      ...branchFilter,
      ...(input.scope === 'batch' && input.batchId ? { batchId: input.batchId } : {}),
      ...(programIds ? { programId: { in: programIds } } : {}),
      ...(input.scope === 'branch' && input.branchId ? { branchId: input.branchId } : {}),
    };

    const structures = await this.prisma.feeStructure.findMany({
      where: structureWhere,
      select: { id: true, branchId: true, batchId: true, programId: true },
    });

    const students = await this.prisma.student.findMany({
      where: {
        deletedAt: null,
        ...branchFilter,
        ...(input.scope === 'batch' && input.batchId ? { batchId: input.batchId } : {}),
        ...(programIds ? { programId: { in: programIds } } : {}),
        ...(input.scope === 'branch' && input.branchId ? { branchId: input.branchId } : {}),
      },
      select: { id: true },
    });

    return {
      structureIds: structures.map((s) => s.id),
      studentIds: students.map((s) => s.id),
    };
  }

  async waiveInvoice(id: string, user: AuthUser, scope: BranchScope) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const current = await this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } });
    if (current?.code === 'waived') throw new BadRequestException('Invoice is already waived');
    if (current?.code === 'paid') throw new BadRequestException('Cannot waive a paid invoice');

    const waivedStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'waived', category: { code: 'fee_status' } },
    });
    if (!waivedStatus) throw new BadRequestException('Fee status lookup not configured: waived');

    const paid = this.getPaidAmount(invoice);
    const amount = this.roundMoney(Number(invoice.amount));
    const discount = this.roundMoney(amount - paid);
    await this.prisma.feeInvoice.update({
      where: { id },
      data: {
        discount,
        fine: 0,
        netAmount: paid,
        statusId: waivedStatus.id,
        paidAt: null,
      },
    });
    const updated = await this.syncInvoiceAfterPayment(id);
    await this.audit.log({
      userId: user.id,
      action: 'fee_invoice.waived',
      entityType: 'FeeInvoice',
      entityId: id,
      previousValue: invoice,
      newValue: updated,
    });
    const [feeType, status] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: updated.feeTypeId } }),
      this.prisma.lookupStatus.findUnique({ where: { id: updated.statusId } }),
    ]);
    return {
      ...this.toResponse(
        updated,
        feeType ? new Map([[feeType.id, feeType]]) : new Map(),
        status ? new Map([[status.id, status]]) : new Map(),
      ),
      ...this.paymentSummary(updated),
    };
  }

  async unwaiveInvoice(id: string, user: AuthUser, scope: BranchScope) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
        student: { select: { monthlyFeeDiscount: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const current = await this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } });
    if (current?.code !== 'waived') throw new BadRequestException('Invoice is not waived');
    if (this.getPaidAmount(invoice) > 0) {
      throw new BadRequestException('Cannot unwaive an invoice that already has payments');
    }

    const pendingStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'pending', category: { code: 'fee_status' } },
    });
    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');
    const feeType = await this.prisma.feeType.findUnique({ where: { id: invoice.feeTypeId } });
    const amount = this.roundMoney(Number(invoice.amount));
    const discount =
      feeType?.code === 'monthly'
        ? Math.min(amount, this.roundMoney(Number(invoice.student.monthlyFeeDiscount)))
        : 0;
    const netAmount = this.roundMoney(amount - discount);
    await this.prisma.feeInvoice.update({
      where: { id },
      data: {
        discount,
        fine: 0,
        netAmount,
        statusId: pendingStatus.id,
        paidAt: null,
      },
    });
    const updated = await this.syncInvoiceAfterPayment(id);
    await this.audit.log({
      userId: user.id,
      action: 'fee_invoice.unwaived',
      entityType: 'FeeInvoice',
      entityId: id,
      newValue: updated,
    });
    const status = await this.prisma.lookupStatus.findUnique({ where: { id: updated.statusId } });
    return {
      ...this.toResponse(
        updated,
        feeType ? new Map([[feeType.id, feeType]]) : new Map(),
        status ? new Map([[status.id, status]]) : new Map(),
      ),
      ...this.paymentSummary(updated),
    };
  }

  async updateStudentFeePolicy(
    studentId: string,
    input: UpdateStudentFeePolicyInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (input.annualChargeMode === 'deferred' && !input.annualDeferredUntil) {
      throw new BadRequestException('Defer until date is required');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        ...(input.monthlyFeeDiscount !== undefined
          ? { monthlyFeeDiscount: input.monthlyFeeDiscount }
          : {}),
        ...(input.monthlyFeeAmount !== undefined
          ? { monthlyFeeAmount: input.monthlyFeeAmount }
          : {}),
        ...(input.monthlyFeeWaived !== undefined
          ? { monthlyFeeWaived: input.monthlyFeeWaived }
          : {}),
        ...(input.annualChargeMode !== undefined
          ? { annualChargeMode: input.annualChargeMode }
          : {}),
        ...(input.annualDeferredUntil !== undefined
          ? {
              annualDeferredUntil: input.annualDeferredUntil
                ? parseCalendarDate(input.annualDeferredUntil)
                : null,
            }
          : {}),
        ...(input.annualInstallmentCount !== undefined
          ? { annualInstallmentCount: input.annualInstallmentCount }
          : {}),
      },
    });

    if (input.monthlyFeeDiscount !== undefined) {
      const monthlyType = await this.prisma.feeType.findUnique({ where: { code: 'monthly' } });
      if (monthlyType) {
        const latest = await this.prisma.feeInvoice.findFirst({
          where: { studentId, feeTypeId: monthlyType.id, billingPeriod: { not: null } },
          orderBy: { billingPeriod: 'desc' },
        });
        if (latest) {
          await this.cascadeDiscountToFutureInvoices({
            sourceInvoiceId: latest.id,
            studentId,
            feeTypeId: monthlyType.id,
            billingPeriod: latest.billingPeriod,
            dueDate: latest.dueDate,
            discount: this.roundMoney(input.monthlyFeeDiscount),
            scope,
          });
        }
      }
    }

    if (input.annualChargeMode === 'waived') {
      const annualType = await this.prisma.feeType.findUnique({ where: { code: 'annual' } });
      if (annualType) await this.waiveUnpaidAnnualInvoices(studentId, annualType.id);
    }

    await this.audit.log({
      userId: user.id,
      action: 'student.fee_policy.updated',
      entityType: 'Student',
      entityId: studentId,
      previousValue: student,
      newValue: updated,
    });

    return {
      id: updated.id,
      monthlyFeeDiscount: Number(updated.monthlyFeeDiscount),
      monthlyFeeAmount: updated.monthlyFeeAmount != null ? Number(updated.monthlyFeeAmount) : null,
      monthlyFeeWaived: updated.monthlyFeeWaived,
      annualChargeMode: updated.annualChargeMode,
      annualDeferredUntil: updated.annualDeferredUntil?.toISOString() ?? null,
      annualInstallmentCount: updated.annualInstallmentCount,
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getPaidAmount(invoice: {
    payments?: Array<{ amount: { toString(): string } }>;
  }): number {
    const paid = (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return this.roundMoney(paid);
  }

  private getRemainingAmount(invoice: {
    netAmount: { toString(): string };
    payments?: Array<{ amount: { toString(): string } }>;
  }): number {
    return Math.max(0, this.roundMoney(Number(invoice.netAmount) - this.getPaidAmount(invoice)));
  }

  private paymentSummary(invoice: {
    netAmount: { toString(): string };
    payments?: Array<{ amount: { toString(): string } }>;
  }) {
    const paidAmount = this.getPaidAmount(invoice);
    return {
      paidAmount,
      remainingAmount: this.getRemainingAmount(invoice),
    };
  }

  private async getFeeStatusMap(): Promise<Map<string, string>> {
    const statuses = await this.prisma.lookupStatus.findMany({
      where: { category: { code: 'fee_status' } },
    });
    return new Map(statuses.map((s) => [s.code, s.id]));
  }

  async getStudentFees(studentId: string, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId },
      include: {
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
        lines: { orderBy: { sortOrder: 'asc' as const } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const feeTypeIds = [
      ...new Set([
        ...invoices.map((i) => i.feeTypeId),
        ...invoices.flatMap((i) => i.lines.map((line) => line.feeTypeId)),
      ]),
    ];
    const statusIds = [...new Set(invoices.map((i) => i.statusId))];
    const [feeTypes, statuses] = await Promise.all([
      this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } }),
      this.prisma.lookupStatus.findMany({ where: { id: { in: statusIds } } }),
    ]);
    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    const outstanding = invoices.reduce((sum, inv) => sum + this.getRemainingAmount(inv), 0);

    return {
      studentId,
      studentName: student.fullName,
      outstanding,
      invoices: invoices.map((inv) => ({
        ...this.toResponse(inv, feeTypeMap, statusMap),
        ...this.paymentSummary(inv),
      })),
    };
  }

  async listStructures(query: ListFeeStructuresQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const search = query.search?.trim();
    const structures = await this.prisma.feeStructure.findMany({
      where: {
        ...prismaBranchFilter(effective),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
        ...(query.isActive !== undefined
          ? { isActive: query.isActive }
          : query.includeInactive
            ? {}
            : { isActive: true }),
        ...(search
          ? { feeType: { name: { contains: search, mode: 'insensitive' as const } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const feeTypeIds = [...new Set(structures.map((s) => s.feeTypeId))];
    const feeTypes = await this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } });
    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));

    return {
      data: structures.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        feeTypeId: s.feeTypeId,
        feeType: feeTypeMap.get(s.feeTypeId) ?? null,
        programId: s.programId,
        batchId: s.batchId,
        amount: Number(s.amount),
        dueDayOfMonth: s.dueDayOfMonth,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  async createStructure(input: CreateFeeStructureInput, user: AuthUser) {
    const feeType = await this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } });
    if (!feeType) throw new BadRequestException('Invalid fee type');

    const structure = await this.prisma.feeStructure.create({
      data: {
        branchId: input.branchId,
        feeTypeId: input.feeTypeId,
        programId: input.programId,
        batchId: input.batchId,
        amount: input.amount,
        dueDayOfMonth: input.dueDayOfMonth,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_structure.created',
      entityType: 'FeeStructure',
      entityId: structure.id,
      newValue: structure,
    });

    return { id: structure.id, amount: Number(structure.amount) };
  }

  async updateStructure(id: string, input: UpdateFeeStructureInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.feeStructure.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');

    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        ...(input.feeTypeId !== undefined ? { feeTypeId: input.feeTypeId } : {}),
        ...(input.programId !== undefined ? { programId: input.programId } : {}),
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.dueDayOfMonth !== undefined ? { dueDayOfMonth: input.dueDayOfMonth } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_structure.updated',
      entityType: 'FeeStructure',
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });

    return { id: updated.id };
  }

  async deleteStructure(id: string, user: AuthUser, scope: BranchScope) {
    return this.updateStructure(id, { isActive: false }, user, scope);
  }

  async previewBulkInvoices(input: PreviewBulkInvoicesInput) {
    const typeIds = await this.resolveBulkFeeTypeIds(input);
    const feeTypes = await this.prisma.feeType.findMany({ where: { id: { in: typeIds } } });
    if (feeTypes.length === 0) throw new BadRequestException('Invalid fee type');
    const feeTypeById = new Map(feeTypes.map((row) => [row.id, row]));
    const orderedTypes = typeIds
      .map((id) => feeTypeById.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const feeType = orderedTypes[0]!;

    const activeStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'active', category: { code: 'student_status' } },
    });

    const students = await this.prisma.student.findMany({
      where: {
        branchId: input.branchId,
        deletedAt: null,
        ...(input.batchId ? { batchId: input.batchId } : {}),
        ...(activeStatus ? { statusId: activeStatus.id } : {}),
      },
      select: {
        id: true,
        fullName: true,
        programId: true,
        batchId: true,
        monthlyFeeDiscount: true,
        monthlyFeeAmount: true,
        monthlyFeeWaived: true,
        annualChargeMode: true,
        annualDeferredUntil: true,
        annualInstallmentCount: true,
        program: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const structuresByType = new Map<string, Awaited<ReturnType<FeesService['loadFeeStructuresForBulk']>>>();
    for (const type of orderedTypes) {
      structuresByType.set(
        type.id,
        await this.loadFeeStructuresForBulk({
          branchId: input.branchId,
          feeTypeId: type.id,
          feeStructureId: orderedTypes.length === 1 ? input.feeStructureId : undefined,
        }),
      );
    }

    const overrideAmount =
      input.defaultAmount !== undefined ? this.roundMoney(input.defaultAmount) : null;

    const previewStudents = students.map((student) => {
      const linePreviews: Array<{
        feeTypeId: string;
        label: string;
        amount: number;
        feeStructureId: string | null;
        dueDayOfMonth: number | null;
      }> = [];
      for (const type of orderedTypes) {
        const structures = structuresByType.get(type.id) ?? [];
        const structure = this.matchFeeStructureForStudent(structures, {
          batchId: student.batchId,
          programId: student.programId,
          feeStructureId: orderedTypes.length === 1 ? input.feeStructureId : undefined,
        });
        const structureAmount = structure ? this.roundMoney(Number(structure.amount)) : null;
        const listedAmount =
          type.code === 'monthly' && student.monthlyFeeAmount != null
            ? this.roundMoney(Number(student.monthlyFeeAmount))
            : structureAmount;
        const suggested = listedAmount ?? (orderedTypes.length === 1 ? overrideAmount : null);
        if (suggested != null && suggested > 0) {
          linePreviews.push({
            feeTypeId: type.id,
            label: type.name,
            amount: suggested,
            feeStructureId: structure?.id ?? null,
            dueDayOfMonth: structure?.dueDayOfMonth ?? null,
          });
        }
      }
      const suggestedAmount =
        linePreviews.length > 0
          ? this.roundMoney(linePreviews.reduce((sum, line) => sum + line.amount, 0))
          : null;

      return {
        studentId: student.id,
        fullName: student.fullName,
        programId: student.programId,
        batchId: student.batchId,
        programName: student.program?.name ?? null,
        batchName: student.batch?.name ?? null,
        feeStructureId: linePreviews.length === 1 ? linePreviews[0]!.feeStructureId : null,
        defaultAmount: suggestedAmount,
        suggestedAmount,
        dueDayOfMonth: linePreviews[0]?.dueDayOfMonth ?? null,
        monthlyFeeWaived: student.monthlyFeeWaived,
        annualChargeMode: student.annualChargeMode,
        lines: linePreviews,
      };
    });

    const matchedWithStructure = previewStudents.filter((s) => (s.lines?.length ?? 0) > 0);
    const uniqueStructureIds = new Set(
      matchedWithStructure.map((s) => s.feeStructureId).filter((id): id is string => Boolean(id)),
    );
    const amounts = matchedWithStructure
      .map((s) => s.suggestedAmount)
      .filter((a): a is number => a !== null);
    const uniqueAmounts = new Set(amounts);

    return {
      feeType: { id: feeType.id, name: feeType.name, code: feeType.code },
      feeTypes: orderedTypes.map((type) => ({ id: type.id, name: type.name, code: type.code })),
      scope: input.batchId ? 'batch' : 'branch',
      feeStructureId: uniqueStructureIds.size === 1 ? [...uniqueStructureIds][0]! : null,
      defaultAmount: uniqueAmounts.size === 1 ? [...uniqueAmounts][0]! : null,
      dueDayOfMonth:
        matchedWithStructure.length > 0 &&
        matchedWithStructure.every(
          (s) => s.dueDayOfMonth === matchedWithStructure[0]!.dueDayOfMonth,
        )
          ? matchedWithStructure[0]!.dueDayOfMonth
          : null,
      students: previewStudents,
    };
  }

  async generateBulkInvoices(input: GenerateBulkInvoicesInput, user: AuthUser) {
    const selectedLines = (input.lines ?? []).filter((line) => line.include !== false);
    if (selectedLines.length > 0) {
      return this.generateBulkInvoicesFromLines({ ...input, lines: selectedLines }, user);
    }

    const students = await this.prisma.student.findMany({
      where: {
        branchId: input.branchId,
        deletedAt: null,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      select: { id: true },
    });
    if (students.length === 0) {
      throw new BadRequestException(input.batchId ? 'No students in batch' : 'No students in branch');
    }

    return this.generateBulkInvoicesFromLines(
      {
        ...input,
        lines: students.map((student) => ({ studentId: student.id, amount: 0, include: true })),
      },
      user,
    );
  }

  private async generateBulkInvoicesFromLines(input: GenerateBulkInvoicesInput, user: AuthUser) {
    const typeIds = await this.resolveBulkFeeTypeIds(input);
    if (typeIds.length === 0) throw new BadRequestException('Fee type is required');

    const selectedLines = (input.lines ?? []).filter((line) => line.include !== false);
    if (selectedLines.length === 0) {
      throw new BadRequestException('Select at least one student');
    }

    const studentIds = selectedLines.map((l) => l.studentId);
    const feeTypes = await this.prisma.feeType.findMany({ where: { id: { in: typeIds } } });
    const feeTypeById = new Map(feeTypes.map((row) => [row.id, row]));
    const orderedTypes = typeIds
      .map((id) => feeTypeById.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (orderedTypes.length === 0) throw new BadRequestException('Invalid fee type');

    const [scopeStudents, pendingStatus, waivedStatus, siblingInfo, branch] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          branchId: input.branchId,
          deletedAt: null,
          ...(input.batchId ? { batchId: input.batchId } : {}),
          id: { in: studentIds },
        },
        select: {
          id: true,
          programId: true,
          batchId: true,
          admissionNumber: true,
          rollNumber: true,
          monthlyFeeDiscount: true,
          monthlyFeeAmount: true,
          monthlyFeeWaived: true,
          annualChargeMode: true,
          annualDeferredUntil: true,
          annualInstallmentCount: true,
        },
      }),
      this.prisma.lookupStatus.findFirst({
        where: { code: 'pending', category: { code: 'fee_status' } },
      }),
      this.prisma.lookupStatus.findFirst({
        where: { code: 'waived', category: { code: 'fee_status' } },
      }),
      this.loadSiblingDiscountContext(studentIds),
      this.prisma.branch.findUnique({
        where: { id: input.branchId },
        select: { code: true },
      }),
    ]);

    const structuresByType = new Map<string, Awaited<ReturnType<FeesService['loadFeeStructuresForBulk']>>>();
    for (const type of orderedTypes) {
      structuresByType.set(
        type.id,
        await this.loadFeeStructuresForBulk({ branchId: input.branchId, feeTypeId: type.id }),
      );
    }

    const scopeStudentIds = new Set(scopeStudents.map((s) => s.id));
    for (const line of selectedLines) {
      if (!scopeStudentIds.has(line.studentId)) {
        throw new BadRequestException(
          input.batchId
            ? 'One or more students are not in the selected batch'
            : 'One or more students are invalid for this branch',
        );
      }
    }

    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');

    const studentById = new Map(scopeStudents.map((s) => [s.id, s]));
    const dueDate = this.resolveBulkDueDate(input.dueDate);
    const billingPeriod = input.billingPeriod ?? billingPeriodFromDate(dueDate);
    const year = new Date().getFullYear();
    const code = (branch?.code ?? 'BR').toUpperCase().slice(0, 8);
    const lineAmountByStudent = new Map(selectedLines.map((line) => [line.studentId, line.amount]));

    type BulkParticular = {
      feeTypeId: string;
      label: string;
      amount: number;
      waived: boolean;
      reason?: string;
      dueDate: Date;
    };
    type BulkDraft = {
      studentId: string;
      particulars: BulkParticular[];
      amount: number;
      discount: number;
      netAmount: number;
      statusId: string;
      remarks: string | null;
      dueDate: Date;
    };

    const drafts: BulkDraft[] = [];
    for (const selected of selectedLines) {
      const student = studentById.get(selected.studentId)!;
      const particulars: BulkParticular[] = [];

      for (const feeType of orderedTypes) {
        const structures = structuresByType.get(feeType.id) ?? [];
        const structure = this.matchFeeStructureForStudent(structures, {
          batchId: student.batchId,
          programId: student.programId,
        });
        const listed = structure ? this.roundMoney(Number(structure.amount)) : null;
        const override = lineAmountByStudent.get(student.id);
        const requested =
          orderedTypes.length === 1 && override != null && override > 0
            ? this.roundMoney(override)
            : listed != null && listed > 0
              ? listed
              : null;
        if (requested == null || requested <= 0) continue;
        const charge = await this.resolveGenerateAmount({
          student,
          feeType,
          requestedAmount: requested,
          billingPeriod,
        });
        if (charge.skip) continue;
        particulars.push({
          feeTypeId: feeType.id,
          label: feeType.name,
          amount: charge.amount,
          waived: charge.waived,
          reason: charge.reason,
          dueDate: structure?.dueDayOfMonth
            ? new Date(dueDate.getFullYear(), dueDate.getMonth(), structure.dueDayOfMonth)
            : dueDate,
        });
      }

      const override = lineAmountByStudent.get(student.id);
      if (particulars.length === 0 && override != null && override > 0) {
        const feeType = orderedTypes[0]!;
        const charge = await this.resolveGenerateAmount({
          student,
          feeType,
          requestedAmount: this.roundMoney(override),
          billingPeriod,
        });
        if (!charge.skip) {
          particulars.push({
            feeTypeId: feeType.id,
            label: feeType.name,
            amount: charge.amount,
            waived: charge.waived,
            reason: charge.reason,
            dueDate,
          });
        }
      }

      if (particulars.length === 0) continue;

      const amount = this.roundMoney(particulars.reduce((sum, line) => sum + line.amount, 0));
      const monthlyType = orderedTypes.find((type) => type.code === 'monthly');
      const monthlyLine = particulars.find((line) => line.feeTypeId === monthlyType?.id);
      const siblingDiscount = particulars.some((line) => line.waived)
        ? 0
        : siblingInfo.eligibleIds.has(student.id)
          ? Math.round((amount * siblingInfo.percent) / 100)
          : 0;
      const monthlyRecurring = this.monthlyFeeDiscountForType(
        monthlyType?.code,
        Number(student.monthlyFeeDiscount),
        monthlyLine?.amount ?? amount,
      );
      const { discount, remarks } = this.composeInvoiceDiscount({
        amount,
        siblingDiscount,
        monthlyRecurring,
      });
      const waivedAll = particulars.every((line) => line.waived);
      const effectiveDiscount = waivedAll ? amount : discount;
      const netAmount = this.roundMoney(amount - effectiveDiscount);
      const statusId = waivedAll && waivedStatus ? waivedStatus.id : pendingStatus.id;
      const remarkText = [
        remarks,
        ...particulars.map((line) => line.reason).filter(Boolean),
      ]
        .filter(Boolean)
        .join(' · ');

      drafts.push({
        studentId: student.id,
        particulars,
        amount,
        discount: effectiveDiscount,
        netAmount,
        statusId,
        remarks: remarkText || null,
        dueDate: particulars[0]!.dueDate,
      });
    }

    if (drafts.length === 0) {
      throw new BadRequestException(
        'No invoices to create after applying fee policy (waived, deferred, or already billed)',
      );
    }

    const voucherByStudent = await this.allocateMonthlyVoucherNos({
      branchId: input.branchId,
      billingPeriod,
      branchCode: code,
      students: drafts.map((draft) => {
        const student = studentById.get(draft.studentId)!;
        return {
          id: student.id,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
        };
      }),
    });

    const created = await this.prisma.$transaction(
      async (tx) => {
        const existingRows = await tx.feeInvoice.findMany({
          where: {
            branchId: input.branchId,
            studentId: { in: drafts.map((draft) => draft.studentId) },
            billingPeriod,
            paidAt: null,
          },
          include: {
            payments: { where: { status: { in: ['succeeded', 'completed'] } } },
            lines: true,
          },
        });
        const existingByStudent = new Map(existingRows.map((row) => [row.studentId, row]));
        let invoiceSeq = await tx.feeInvoice.count({ where: { branchId: input.branchId } });

        const toCreate: BulkDraft[] = [];
        let touched = 0;

        for (const draft of drafts) {
          const existing = existingByStudent.get(draft.studentId);
          const paidTotal = existing
            ? this.roundMoney(
                (existing.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0),
              )
            : 0;

          if (existing && paidTotal > 0) continue;

          if (existing && paidTotal === 0) {
            const byType = new Map(existing.lines.map((line) => [line.feeTypeId, line]));
            const lineCreates: Array<{
              invoiceId: string;
              feeTypeId: string;
              label: string;
              amount: number;
              sortOrder: number;
            }> = [];
            for (const [index, line] of draft.particulars.entries()) {
              const current = byType.get(line.feeTypeId);
              if (current) {
                await tx.feeInvoiceLine.update({
                  where: { id: current.id },
                  data: { amount: line.amount, label: line.label },
                });
              } else {
                lineCreates.push({
                  invoiceId: existing.id,
                  feeTypeId: line.feeTypeId,
                  label: line.label,
                  amount: line.amount,
                  sortOrder: existing.lines.length + index,
                });
              }
            }
            if (lineCreates.length > 0) {
              await tx.feeInvoiceLine.createMany({ data: lineCreates });
            }
            const nextLines = await tx.feeInvoiceLine.findMany({ where: { invoiceId: existing.id } });
            const nextAmount = this.roundMoney(
              nextLines.reduce((sum, line) => sum + Number(line.amount), 0),
            );
            const nextNet = this.roundMoney(
              nextAmount - Number(existing.discount) + Number(existing.fine),
            );
            await tx.feeInvoice.update({
              where: { id: existing.id },
              data: {
                amount: nextAmount,
                netAmount: nextNet,
                feeTypeId: nextLines[0]?.feeTypeId ?? existing.feeTypeId,
              },
            });
            touched += 1;
            continue;
          }

          toCreate.push(draft);
        }

        if (toCreate.length > 0) {
          const createdRows = await tx.feeInvoice.createManyAndReturn({
            data: toCreate.map((draft) => {
              invoiceSeq += 1;
              return {
                branchId: input.branchId,
                studentId: draft.studentId,
                feeTypeId: draft.particulars[0]!.feeTypeId,
                invoiceNo: `INV-${code}-${year}-${String(invoiceSeq).padStart(5, '0')}`,
                billingPeriod,
                voucherNo: voucherByStudent.get(draft.studentId) ?? null,
                amount: draft.amount,
                discount: draft.discount,
                fine: 0,
                netAmount: draft.netAmount,
                dueDate: draft.dueDate,
                statusId: draft.statusId,
                remarks: draft.remarks,
                createdById: user.id,
              };
            }),
            select: { id: true, studentId: true },
          });
          const createdByStudent = new Map(createdRows.map((row) => [row.studentId, row.id]));
          const lineRows = toCreate.flatMap((draft) => {
            const invoiceId = createdByStudent.get(draft.studentId);
            if (!invoiceId) return [];
            return draft.particulars.map((line, index) => ({
              invoiceId,
              feeTypeId: line.feeTypeId,
              label: line.label,
              amount: line.amount,
              sortOrder: index,
            }));
          });
          if (lineRows.length > 0) {
            await tx.feeInvoiceLine.createMany({ data: lineRows });
          }
          touched += createdRows.length;
        }

        return touched;
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    if (created === 0) {
      throw new BadRequestException(
        'No invoices to create after applying fee policy (waived, deferred, or already billed)',
      );
    }

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoices.bulk_generated',
      entityType: input.batchId ? 'Batch' : 'Branch',
      entityId: input.batchId ?? input.branchId,
      newValue: { count: created, feeTypeIds: typeIds },
    });

    return { created };
  }

  private resolveBulkDueDate(dueDate?: string) {
    if (dueDate) return new Date(dueDate);
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d;
  }

  private async resolveBulkFeeTypeIds(input: {
    branchId: string;
    feeTypeId?: string;
    feeTypeIds?: string[];
  }): Promise<string[]> {
    const explicit = [
      ...new Set([...(input.feeTypeIds ?? []), ...(input.feeTypeId ? [input.feeTypeId] : [])]),
    ];
    if (explicit.length > 0) return explicit;

    const structures = await this.prisma.feeStructure.findMany({
      where: { branchId: input.branchId, isActive: true },
      select: { feeTypeId: true },
      distinct: ['feeTypeId'],
    });
    const typeIds = structures.map((row) => row.feeTypeId);
    if (typeIds.length === 0) {
      throw new BadRequestException('No active fee structures for this branch');
    }
    return typeIds;
  }

  private async resolveInvoiceLineSpecs(input: {
    feeTypeId?: string;
    amount?: number;
    lines?: Array<{ feeTypeId: string; label?: string | null; amount: number; sortOrder?: number }>;
  }): Promise<Array<{ feeTypeId: string; label: string; amount: number; sortOrder?: number }>> {
    if (input.lines?.length) {
      const typeIds = [...new Set(input.lines.map((line) => line.feeTypeId))];
      const feeTypes = await this.prisma.feeType.findMany({ where: { id: { in: typeIds } } });
      const byId = new Map(feeTypes.map((row) => [row.id, row]));
      return input.lines.map((line, index) => ({
        feeTypeId: line.feeTypeId,
        label: line.label?.trim() || byId.get(line.feeTypeId)?.name || 'Fee',
        amount: this.roundMoney(line.amount),
        sortOrder: line.sortOrder ?? index,
      }));
    }

    if (!input.feeTypeId || input.amount == null) {
      throw new BadRequestException('Fee type and amount are required');
    }
    const feeType = await this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } });
    if (!feeType) throw new BadRequestException('Invalid fee type');
    return [
      {
        feeTypeId: feeType.id,
        label: feeType.name,
        amount: this.roundMoney(input.amount),
        sortOrder: 0,
      },
    ];
  }

  private async loadFeeStructuresForBulk(input: {
    branchId: string;
    feeTypeId: string;
    feeStructureId?: string;
  }) {
    if (input.feeStructureId) {
      const structure = await this.prisma.feeStructure.findFirst({
        where: {
          id: input.feeStructureId,
          branchId: input.branchId,
          feeTypeId: input.feeTypeId,
          isActive: true,
        },
      });
      if (!structure) throw new BadRequestException('Invalid fee structure');
      return [structure];
    }

    return this.prisma.feeStructure.findMany({
      where: {
        branchId: input.branchId,
        feeTypeId: input.feeTypeId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pick the best FeeStructure for a student:
   * explicit id → exact batch → program (batch null) → branch default (program+batch null).
   */
  private matchFeeStructureForStudent(
    structures: Array<{
      id: string;
      amount: { toString(): string } | number;
      dueDayOfMonth: number | null;
      programId: string | null;
      batchId: string | null;
      feeTypeId: string;
    }>,
    student: { batchId: string | null; programId: string | null; feeStructureId?: string },
  ) {
    if (student.feeStructureId) {
      return structures.find((s) => s.id === student.feeStructureId) ?? null;
    }

    if (student.batchId) {
      const byBatch = structures.find((s) => s.batchId === student.batchId);
      if (byBatch) return byBatch;
    }
    if (student.programId) {
      const byProgram = structures.find(
        (s) => s.programId === student.programId && s.batchId === null,
      );
      if (byProgram) return byProgram;
    }
    return structures.find((s) => s.programId === null && s.batchId === null) ?? null;
  }

  async createFeeType(input: CreateFeeTypeInput, user: AuthUser) {
    const existing = await this.prisma.feeType.findUnique({ where: { code: input.code } });
    if (existing) throw new BadRequestException('Fee type code already exists');

    const feeType = await this.prisma.feeType.create({ data: input });
    await this.audit.log({
      userId: user.id,
      action: 'fee_type.created',
      entityType: 'FeeType',
      entityId: feeType.id,
      newValue: feeType,
    });
    return feeType;
  }

  async updateFeeType(id: string, input: UpdateFeeTypeInput, user: AuthUser) {
    const existing = await this.prisma.feeType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fee type not found');

    // Code is immutable after create to keep invoice/report references stable.
    const { code: _code, ...safeInput } = input;

    const updated = await this.prisma.feeType.update({
      where: { id },
      data: safeInput,
    });
    await this.audit.log({
      userId: user.id,
      action: 'fee_type.updated',
      entityType: 'FeeType',
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });
    return updated;
  }

  async getInvoice(id: string, scope: BranchScope) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        student: { select: { id: true, fullName: true, phone: true, email: true } },
        lines: { orderBy: { sortOrder: 'asc' as const } },
        payments: { where: { status: { in: ['succeeded', 'completed'] } } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const lineTypeIds = invoice.lines.map((line) => line.feeTypeId);
    const [feeTypes, status, settings] = await Promise.all([
      this.prisma.feeType.findMany({
        where: { id: { in: [...new Set([invoice.feeTypeId, ...lineTypeIds])] } },
      }),
      this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } }),
      this.prisma.institutionSettings.findFirst(),
    ]);
    const feeTypeMap = new Map(feeTypes.map((row) => [row.id, row]));
    const statusMap = status ? new Map([[status.id, status]]) : new Map();

    return {
      ...this.toResponse(invoice, feeTypeMap, statusMap),
      institutionName: settings?.name ?? 'Institution',
      ...this.paymentSummary(invoice),
    };
  }

  private async computeSiblingDiscount(studentId: string, amount: number): Promise<number> {
    const { percent, eligibleIds } = await this.loadSiblingDiscountContext([studentId]);
    if (percent <= 0 || !eligibleIds.has(studentId)) return 0;
    return Math.round((amount * percent) / 100);
  }

  /** Fixed monthly tuition discount; only when fee type code is `monthly`. */
  private monthlyFeeDiscountForType(
    feeTypeCode: string | null | undefined,
    studentMonthlyDiscount: number,
    amount: number,
  ): number {
    if (feeTypeCode !== 'monthly') return 0;
    const recurring = this.roundMoney(studentMonthlyDiscount);
    if (recurring <= 0) return 0;
    return Math.min(recurring, this.roundMoney(amount));
  }

  private composeInvoiceDiscount(opts: {
    amount: number;
    extraDiscount?: number;
    siblingDiscount: number;
    monthlyRecurring: number;
    existingRemarks?: string | null;
  }): { discount: number; remarks: string | null } {
    const amount = this.roundMoney(opts.amount);
    const extra = this.roundMoney(opts.extraDiscount ?? 0);
    const sibling = this.roundMoney(opts.siblingDiscount);
    const monthly = this.roundMoney(opts.monthlyRecurring);
    const discount = Math.min(amount, Math.max(0, extra + sibling + monthly));
    const parts: string[] = [];
    if (opts.existingRemarks?.trim()) parts.push(opts.existingRemarks.trim());
    if (monthly > 0) parts.push(`Monthly fee discount: ${monthly}`);
    if (sibling > 0) parts.push(`Sibling discount applied: ${sibling}`);
    return { discount, remarks: parts.length ? parts.join(' · ') : null };
  }

  /** One settings + sibling graph lookup for many students (bulk generate). */
  private async loadSiblingDiscountContext(studentIds: string[]): Promise<{
    percent: number;
    eligibleIds: Set<string>;
  }> {
    const eligibleIds = new Set<string>();
    if (studentIds.length === 0) return { percent: 0, eligibleIds };

    const settings = await this.prisma.institutionSettings.findFirst();
    const percent = settings?.siblingDiscountPercent ? Number(settings.siblingDiscountPercent) : 0;
    if (percent <= 0) return { percent: 0, eligibleIds };

    const parentLinks = await this.prisma.studentParent.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, parentId: true },
    });
    if (parentLinks.length === 0) return { percent, eligibleIds };

    const parentIds = [...new Set(parentLinks.map((p) => p.parentId))];
    const familyLinks = await this.prisma.studentParent.findMany({
      where: { parentId: { in: parentIds } },
      select: { studentId: true, parentId: true },
    });

    const siblingsByParent = new Map<string, Set<string>>();
    for (const link of familyLinks) {
      const set = siblingsByParent.get(link.parentId) ?? new Set<string>();
      set.add(link.studentId);
      siblingsByParent.set(link.parentId, set);
    }

    const parentsByStudent = new Map<string, string[]>();
    for (const link of parentLinks) {
      const list = parentsByStudent.get(link.studentId) ?? [];
      list.push(link.parentId);
      parentsByStudent.set(link.studentId, list);
    }

    for (const studentId of studentIds) {
      const parents = parentsByStudent.get(studentId) ?? [];
      const hasSibling = parents.some((parentId) => {
        const family = siblingsByParent.get(parentId);
        if (!family || family.size <= 1) return false;
        for (const otherId of family) {
          if (otherId !== studentId) return true;
        }
        return false;
      });
      if (hasSibling) eligibleIds.add(studentId);
    }

    return { percent, eligibleIds };
  }

  private async applyLateFeesToOverdue(scope: BranchScope) {
    const settings = await this.prisma.institutionSettings.findFirst();
    const lateFeeAmount = settings?.lateFeeAmount ? Number(settings.lateFeeAmount) : 0;
    const daysAfterDue = settings?.lateFeeDaysAfterDue ?? 0;
    if (lateFeeAmount <= 0 || daysAfterDue <= 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysAfterDue);

    const overdueStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'overdue', category: { code: 'fee_status' } },
    });
    const pendingStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'pending', category: { code: 'fee_status' } },
    });
    if (!overdueStatus || !pendingStatus) return;

    const overdueInvoices = await this.prisma.feeInvoice.findMany({
      where: {
        ...prismaBranchFilter(scope),
        paidAt: null,
        dueDate: { lte: cutoff },
        statusId: { in: [pendingStatus.id, overdueStatus.id] },
        fine: 0,
      },
      take: 100,
    });

    for (const inv of overdueInvoices) {
      const fine = lateFeeAmount;
      const netAmount = Number(inv.amount) - Number(inv.discount) + fine;
      await this.prisma.feeInvoice.update({
        where: { id: inv.id },
        data: { fine, netAmount, statusId: overdueStatus.id },
      });
    }
  }

  private async nextDocumentNumber(branchId: string, prefix: 'INV' | 'RCP'): Promise<string> {
    const year = new Date().getFullYear();
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });
    const code = (branch?.code ?? 'BR').toUpperCase().slice(0, 8);
    const count =
      prefix === 'INV'
        ? await this.prisma.feeInvoice.count({ where: { branchId } })
        : await this.prisma.feePayment.count({ where: { branchId } });
    return `${prefix}-${code}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  /** Branch-identifying challan no: `{CAMPUS}-{YYYY}-{#####}` (sequence per branch + year). */
  private async nextChallanNumber(branchId: string): Promise<string> {
    const year = new Date().getFullYear();
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });
    const code = (branch?.code ?? 'BR').toUpperCase().slice(0, 8);
    const prefix = `${code}-${year}-`;

    const existing = await this.prisma.feeChallan.findMany({
      where: { branchId, challanNo: { startsWith: prefix } },
      select: { challanNo: true },
    });

    let maxSeq = 0;
    for (const row of existing) {
      const tail = row.challanNo?.slice(prefix.length) ?? '';
      if (!/^\d+$/.test(tail)) continue;
      const n = Number.parseInt(tail, 10);
      if (n > maxSeq) maxSeq = n;
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  async getInvoicePrintData(id: string, scope: BranchScope) {
    const [row] = await this.loadInvoicePrintRows([id], scope);
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }

  async getInvoicePrintDataBulk(ids: string[], scope: BranchScope) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 90);
    if (unique.length === 0) throw new BadRequestException('Select at least one invoice');
    const invoices = await this.loadInvoicePrintRows(unique, scope);
    if (invoices.length === 0) throw new NotFoundException('Invoice not found');
    return { invoices };
  }

  private async loadInvoicePrintRows(ids: string[], scope: BranchScope) {
    const invoices = await this.prisma.feeInvoice.findMany({
      where: { id: { in: ids }, ...prismaBranchFilter(scope) },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            rollNumber: true,
            admissionNumber: true,
            photographUrl: true,
            phone: true,
            program: { select: { name: true } },
            batch: { select: { name: true } },
            branch: { select: { name: true, code: true } },
          },
        },
        lines: { orderBy: { sortOrder: 'asc' as const } },
      },
    });
    if (invoices.length === 0) return [];

    const feeTypeIds = [
      ...new Set([
        ...invoices.map((invoice) => invoice.feeTypeId),
        ...invoices.flatMap((invoice) => invoice.lines.map((line) => line.feeTypeId)),
      ]),
    ];
    const statusIds = [...new Set(invoices.map((invoice) => invoice.statusId))];
    const branchIds = [...new Set(invoices.map((invoice) => invoice.branchId))];

    const [feeTypes, statuses, settings, templates] = await Promise.all([
      this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } }),
      this.prisma.lookupStatus.findMany({ where: { id: { in: statusIds } } }),
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findMany({
        where: {
          type: 'fee_invoice',
          isActive: true,
          OR: [{ branchId: { in: branchIds } }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);
    const feeTypeMap = new Map(feeTypes.map((row) => [row.id, row]));
    const statusMap = new Map(statuses.map((row) => [row.id, row]));
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    return ids
      .map((id) => byId.get(id))
      .filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice))
      .map((invoice) => {
        const feeType = feeTypeMap.get(invoice.feeTypeId);
        const status = statusMap.get(invoice.statusId);
        const template =
          templates.find((row) => row.branchId === invoice.branchId) ??
          templates.find((row) => row.branchId == null) ??
          null;
        const lines =
          invoice.lines.length > 0
            ? invoice.lines.map((line) => ({
                feeTypeId: line.feeTypeId,
                label: line.label,
                amount: Number(line.amount),
              }))
            : [
                {
                  feeTypeId: invoice.feeTypeId,
                  label: feeType?.name ?? 'Fee',
                  amount: Number(invoice.amount),
                },
              ];
        return {
          invoice: {
            id: invoice.id,
            invoiceNo: invoice.invoiceNo,
            voucherNo: invoice.voucherNo,
            billingPeriod: invoice.billingPeriod,
            amount: Number(invoice.amount),
            discount: Number(invoice.discount),
            fine: Number(invoice.fine),
            netAmount: Number(invoice.netAmount),
            dueDate: invoice.dueDate?.toISOString() ?? null,
            paidAt: invoice.paidAt?.toISOString() ?? null,
            remarks: invoice.remarks,
            status: status ? { code: status.code, label: status.label } : null,
            feeType: feeType ? { name: feeType.name, code: feeType.code } : null,
            lines,
          },
          student: {
            id: invoice.student.id,
            fullName: invoice.student.fullName,
            rollNumber: invoice.student.rollNumber,
            admissionNumber: invoice.student.admissionNumber,
            photographUrl: invoice.student.photographUrl,
            phone: invoice.student.phone,
            program: invoice.student.program?.name ?? null,
            batch: invoice.student.batch?.name ?? null,
            branch: invoice.student.branch,
          },
          institution: {
            name: settings?.name ?? 'Institution',
            logoUrl: settings?.logoUrl ?? null,
            address: settings?.address ?? null,
            phone: settings?.phone ?? null,
            email: settings?.email ?? null,
          },
          template: this.serializePrintTemplate(template, 'fee_invoice'),
        };
      });
  }

  async getPaymentPrintData(id: string, scope: BranchScope) {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        invoice: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                rollNumber: true,
                admissionNumber: true,
                program: { select: { name: true } },
                batch: { select: { name: true } },
                branch: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const [feeType, settings, template] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: payment.invoice.feeTypeId } }),
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'fee_receipt',
          isActive: true,
          OR: [{ branchId: payment.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);

    return {
      payment: {
        id: payment.id,
        receiptNo: payment.receiptNo,
        amount: Number(payment.amount),
        method: payment.method,
        providerRef: payment.providerRef,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
      invoice: {
        id: payment.invoice.id,
        invoiceNo: payment.invoice.invoiceNo,
        voucherNo: payment.invoice.voucherNo,
        billingPeriod: payment.invoice.billingPeriod,
        netAmount: Number(payment.invoice.netAmount),
        feeType: feeType ? { name: feeType.name, code: feeType.code } : null,
      },
      student: {
        id: payment.invoice.student.id,
        fullName: payment.invoice.student.fullName,
        rollNumber: payment.invoice.student.rollNumber,
        admissionNumber: payment.invoice.student.admissionNumber,
        program: payment.invoice.student.program?.name ?? null,
        batch: payment.invoice.student.batch?.name ?? null,
        branch: payment.invoice.student.branch,
      },
      institution: {
        name: settings?.name ?? 'Institution',
        logoUrl: settings?.logoUrl ?? null,
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
      },
      template: this.serializePrintTemplate(template, 'fee_receipt'),
    };
  }

  private serializePrintTemplate(
    template: {
      id: string;
      paperSize: string;
      fields: unknown;
      headerText: string | null;
      footerText: string | null;
      extraNote: string | null;
      name: string;
    } | null,
    type: 'fee_invoice' | 'fee_receipt',
  ) {
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS[type];
    const stored =
      template?.fields && typeof template.fields === 'object' && !Array.isArray(template.fields)
        ? (template.fields as Record<string, boolean>)
        : {};
    return {
      id: template?.id ?? null,
      type,
      name: template?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES[type],
      paperSize: template?.paperSize ?? (type === 'fee_receipt' ? 'thermal80' : 'a4'),
      fields: { ...defaults, ...stored },
      headerText: template?.headerText ?? null,
      footerText: template?.footerText ?? null,
      extraNote: template?.extraNote ?? null,
    };
  }

  private toResponse(
    invoice: {
      id: string;
      branchId: string;
      studentId: string;
      feeTypeId: string;
      invoiceNo?: string | null;
      billingPeriod?: string | null;
      voucherNo?: string | null;
      amount: { toString(): string };
      discount: { toString(): string };
      fine: { toString(): string };
      netAmount: { toString(): string };
      dueDate: Date | null;
      paidAt: Date | null;
      statusId: string;
      remarks: string | null;
      createdAt: Date;
      student?: { id: string; fullName: string };
      lines?: Array<{
        feeTypeId: string;
        label: string;
        amount: { toString(): string } | number;
        sortOrder: number;
      }>;
    },
    feeTypeMap: Map<string, { id: string; name: string; code: string }>,
    statusMap: Map<string, { id: string; code: string; label: string }>,
  ) {
    const lines =
      invoice.lines && invoice.lines.length > 0
        ? invoice.lines.map((line) => ({
            feeTypeId: line.feeTypeId,
            label: line.label,
            amount: Number(line.amount),
            sortOrder: line.sortOrder,
            feeType: feeTypeMap.get(line.feeTypeId) ?? null,
          }))
        : [
            {
              feeTypeId: invoice.feeTypeId,
              label: feeTypeMap.get(invoice.feeTypeId)?.name ?? 'Fee',
              amount: Number(invoice.amount),
              sortOrder: 0,
              feeType: feeTypeMap.get(invoice.feeTypeId) ?? null,
            },
          ];
    return {
      id: invoice.id,
      branchId: invoice.branchId,
      studentId: invoice.studentId,
      student: invoice.student,
      feeTypeId: invoice.feeTypeId,
      feeType: feeTypeMap.get(invoice.feeTypeId) ?? null,
      invoiceNo: invoice.invoiceNo ?? null,
      billingPeriod: invoice.billingPeriod ?? null,
      voucherNo: invoice.voucherNo ?? null,
      amount: Number(invoice.amount),
      discount: Number(invoice.discount),
      fine: Number(invoice.fine),
      netAmount: Number(invoice.netAmount),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      statusId: invoice.statusId,
      status: statusMap.get(invoice.statusId) ?? null,
      remarks: invoice.remarks,
      createdAt: invoice.createdAt.toISOString(),
      lines,
    };
  }

  async listChallans(
    query: ListFeeChallansQuery,
    scope: BranchScope,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const search = query.search?.trim();
    const where = {
      ...prismaBranchFilter(effective),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.billingPeriod ? { billingPeriod: query.billingPeriod } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { challanNo: { contains: search, mode: 'insensitive' as const } },
              { student: { fullName: { contains: search, mode: 'insensitive' as const } } },
              { student: { admissionNumber: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.feeChallan.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              rollNumber: true,
              program: { select: { name: true } },
              batch: { select: { name: true } },
            },
          },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ billingPeriod: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.feeChallan.count({ where }),
    ]);

    return {
      data: rows.map((c) => this.toChallanResponse(c)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async createChallan(input: CreateFeeChallanInput, user: AuthUser) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
    });
    if (!student) throw new BadRequestException('Invalid student for this branch');

    const annualType = await this.prisma.feeType.findUnique({ where: { code: 'annual' } });
    const adjustedLines: CreateFeeChallanInput['lines'] = [];
    for (const line of input.lines) {
      if (line.code !== 'annual' || !annualType) {
        adjustedLines.push(line);
        continue;
      }
      const charge = await this.resolveGenerateAmount({
        student: {
          id: student.id,
          monthlyFeeAmount: student.monthlyFeeAmount,
          monthlyFeeWaived: student.monthlyFeeWaived,
          annualChargeMode: student.annualChargeMode,
          annualDeferredUntil: student.annualDeferredUntil,
          annualInstallmentCount: student.annualInstallmentCount,
        },
        feeType: annualType,
        requestedAmount: this.roundMoney(Number(line.amount)),
        billingPeriod: input.billingPeriod,
      });
      if (charge.skip) continue;
      adjustedLines.push({ ...line, amount: charge.amount });
    }
    if (adjustedLines.length === 0) {
      throw new BadRequestException('No challan lines left after applying fee policy');
    }

    const grandTotal = this.roundMoney(adjustedLines.reduce((s, l) => s + Number(l.amount), 0));
    const challanNo =
      input.challanNo?.trim() ||
      (await this.allocateMonthlyVoucherNo({
        branchId: input.branchId,
        studentId: input.studentId,
        billingPeriod: input.billingPeriod,
      })) ||
      (await this.nextChallanNumber(input.branchId));

    const existing = await this.prisma.feeChallan.findUnique({
      where: {
        branchId_studentId_billingPeriod: {
          branchId: input.branchId,
          studentId: input.studentId,
          billingPeriod: input.billingPeriod,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('A challan already exists for this student and billing period');
    }

    const challan = await this.prisma.feeChallan.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        challanNo,
        billingPeriod: input.billingPeriod,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: grandTotal <= 0 ? 'paid' : 'unpaid',
        grandTotal,
        paidAmount: 0,
        dueAmount: grandTotal,
        sessionLabel: input.sessionLabel ?? null,
        createdById: user.id,
        lines: {
          create: adjustedLines.map((line, idx) => ({
            code: line.code,
            label: line.label,
            amount: line.amount,
            sortOrder: line.sortOrder ?? idx,
            feeInvoiceId: line.feeInvoiceId ?? null,
          })),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            rollNumber: true,
            program: { select: { name: true } },
            batch: { select: { name: true } },
          },
        },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_challan.created',
      entityType: 'FeeChallan',
      entityId: challan.id,
      newValue: { challanNo, billingPeriod: input.billingPeriod, grandTotal },
    });

    return this.toChallanResponse(challan);
  }

  async updateChallan(
    id: string,
    input: UpdateFeeChallanInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const challan = await this.prisma.feeChallan.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!challan) throw new NotFoundException('Challan not found');

    const paidAmount = this.roundMoney(Number(challan.paidAmount));
    const previousValue = {
      dueDate: challan.dueDate?.toISOString() ?? null,
      sessionLabel: challan.sessionLabel,
      grandTotal: Number(challan.grandTotal),
      dueAmount: Number(challan.dueAmount),
      status: challan.status,
      lines: challan.lines.map((l) => ({
        code: l.code,
        label: l.label,
        amount: Number(l.amount),
        sortOrder: l.sortOrder,
        feeInvoiceId: l.feeInvoiceId,
      })),
    };

    const lines = input.lines;
    const grandTotal = lines
      ? this.roundMoney(lines.reduce((s, l) => s + Number(l.amount), 0))
      : this.roundMoney(Number(challan.grandTotal));

    if (grandTotal < paidAmount) {
      throw new BadRequestException(
        `Grand total (${grandTotal}) cannot be less than already paid (${paidAmount}). Adjust payments first.`,
      );
    }

    const dueAmount = this.roundMoney(Math.max(0, grandTotal - paidAmount));
    const status = dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.feeChallanLine.deleteMany({ where: { challanId: id } });
        await tx.feeChallanLine.createMany({
          data: lines.map((line, idx) => ({
            challanId: id,
            code: line.code,
            label: line.label,
            amount: line.amount,
            sortOrder: line.sortOrder ?? idx,
            feeInvoiceId: line.feeInvoiceId ?? null,
          })),
        });
      }

      return tx.feeChallan.update({
        where: { id },
        data: {
          grandTotal,
          dueAmount,
          status,
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          ...(input.sessionLabel !== undefined ? { sessionLabel: input.sessionLabel || null } : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              rollNumber: true,
              program: { select: { name: true } },
              batch: { select: { name: true } },
            },
          },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_challan.updated',
      entityType: 'FeeChallan',
      entityId: id,
      previousValue,
      newValue: {
        dueDate: updated.dueDate?.toISOString() ?? null,
        sessionLabel: updated.sessionLabel,
        grandTotal: Number(updated.grandTotal),
        dueAmount: Number(updated.dueAmount),
        status: updated.status,
        lines: updated.lines.map((l) => ({
          code: l.code,
          label: l.label,
          amount: Number(l.amount),
          sortOrder: l.sortOrder,
          feeInvoiceId: l.feeInvoiceId,
        })),
      },
    });

    return this.toChallanResponse(updated);
  }

  async getChallanPrintData(id: string, scope: BranchScope) {
    const challan = await this.prisma.feeChallan.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            rollNumber: true,
            admissionNumber: true,
            phone: true,
            program: { select: { name: true } },
            batch: { select: { name: true } },
            branch: { select: { name: true, code: true } },
            studentParents: {
              take: 1,
              include: { parent: { select: { fullName: true, phone: true } } },
            },
          },
        },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!challan) throw new NotFoundException('Challan not found');

    const sessionLabel = challan.sessionLabel ?? this.sessionLabelFromPeriod(challan.billingPeriod);
    const sessionPeriods = this.sessionPeriods(sessionLabel);
    const historyRows = await this.prisma.feeChallan.findMany({
      where: {
        branchId: challan.branchId,
        studentId: challan.studentId,
        billingPeriod: { in: sessionPeriods },
      },
      select: { billingPeriod: true, status: true, paidAmount: true, grandTotal: true },
    });
    const historyMap = new Map(historyRows.map((h) => [h.billingPeriod, h]));

    const settings = await this.prisma.institutionSettings.findFirst();
    const father =
      challan.student.studentParents[0]?.parent.fullName ?? null;
    const monthLabel = this.monthLabel(challan.billingPeriod);
    const grandTotal = Number(challan.grandTotal);
    const paidAmount = Number(challan.paidAmount);

    return {
      challan: {
        id: challan.id,
        challanNo: challan.challanNo,
        billingPeriod: challan.billingPeriod,
        monthLabel,
        dueDate: challan.dueDate?.toISOString() ?? null,
        status: challan.status,
        grandTotal,
        paidAmount,
        dueAmount: Number(challan.dueAmount),
        sessionLabel,
        amountInWords: amountInWordsPkr(grandTotal),
        fineNote: 'Amount once paid will not be refunded in any case. After due date Rs. 300 fine will be charged.',
        lines: challan.lines.map((l) => ({
          code: l.code,
          label: l.label,
          amount: Number(l.amount),
          sortOrder: l.sortOrder,
        })),
      },
      student: {
        id: challan.student.id,
        fullName: challan.student.fullName,
        fatherName: father,
        rollNumber: challan.student.rollNumber,
        admissionNumber: challan.student.admissionNumber,
        className: challan.student.batch?.name ?? challan.student.program?.name ?? null,
        phone: challan.student.phone,
        branch: challan.student.branch,
      },
      paymentHistory: sessionPeriods.map((period) => {
        const row = historyMap.get(period);
        return {
          period,
          monthShort: this.monthShort(period),
          status: row?.status ?? 'none',
          paidAmount: row ? Number(row.paidAmount) : 0,
          grandTotal: row ? Number(row.grandTotal) : 0,
        };
      }),
      institution: {
        name: settings?.name ?? 'Institution',
        logoUrl: settings?.logoUrl ?? null,
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
      },
    };
  }

  private toChallanResponse(c: {
    id: string;
    branchId: string;
    studentId: string;
    challanNo: string | null;
    billingPeriod: string;
    dueDate: Date | null;
    status: string;
    grandTotal: { toString(): string };
    paidAmount: { toString(): string };
    dueAmount: { toString(): string };
    sessionLabel: string | null;
    createdAt: Date;
    student?: {
      id: string;
      fullName: string;
      admissionNumber: string | null;
      rollNumber: string | null;
      program?: { name: string } | null;
      batch?: { name: string } | null;
    };
    lines?: Array<{
      id: string;
      code: string;
      label: string;
      amount: { toString(): string };
      sortOrder: number;
      feeInvoiceId: string | null;
    }>;
  }) {
    return {
      id: c.id,
      branchId: c.branchId,
      studentId: c.studentId,
      student: c.student
        ? {
            ...c.student,
            className: c.student.batch?.name ?? c.student.program?.name ?? null,
          }
        : null,
      challanNo: c.challanNo,
      billingPeriod: c.billingPeriod,
      monthLabel: this.monthLabel(c.billingPeriod),
      dueDate: c.dueDate?.toISOString() ?? null,
      status: c.status,
      grandTotal: Number(c.grandTotal),
      paidAmount: Number(c.paidAmount),
      dueAmount: Number(c.dueAmount),
      sessionLabel: c.sessionLabel,
      lines: (c.lines ?? []).map((l) => ({
        id: l.id,
        code: l.code,
        label: l.label,
        amount: Number(l.amount),
        sortOrder: l.sortOrder,
        feeInvoiceId: l.feeInvoiceId,
      })),
      createdAt: c.createdAt.toISOString(),
    };
  }

  private sessionLabelFromPeriod(period: string): string {
    const [y, m] = period.split('-').map(Number);
    if (!y || !m) return `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    if (m >= 4) return `${y}-${y + 1}`;
    return `${y - 1}-${y}`;
  }

  private sessionPeriods(sessionLabel: string): string[] {
    const startYear = Number(String(sessionLabel).split('-')[0]);
    if (!Number.isFinite(startYear)) return [];
    const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    return months.map((month, idx) => {
      const year = idx < 9 ? startYear : startYear + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    });
  }

  private monthLabel(period: string): string {
    const [y, m] = period.split('-');
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  private monthShort(period: string): string {
    const [y, m] = period.split('-');
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    const mon = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${mon} ${String(y).slice(2)}`;
  }
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function amountInWordsPkr(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  if (whole === 0) return 'Zero Rupees Only';
  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1000);
  const hundred = Math.floor((whole % 1000) / 100);
  const rest = whole % 100;
  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return `${parts.join(' ')} Rupees Only`;
}
