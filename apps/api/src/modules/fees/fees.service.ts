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
} from '@eims/shared';
import { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } from '@eims/shared';

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

  async findAll(query: ListFeeInvoicesQuery, scope: BranchScope): Promise<PaginatedResponse<Record<string, unknown>>> {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    await this.applyLateFeesToOverdue(effective);

    const search = query.search?.trim();
    const dueDate =
      query.dueFrom || query.dueTo
        ? {
            ...(query.dueFrom ? { gte: dueDayStart(query.dueFrom) } : {}),
            ...(query.dueTo ? { lte: dueDayEnd(query.dueTo) } : {}),
          }
        : undefined;

    const where = {
      ...prismaBranchFilter(effective),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNo: { contains: search, mode: 'insensitive' as const } },
              { student: { fullName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where,
        include: {
          student: { select: { id: true, fullName: true } },
          payments: {
            where: { status: { in: ['succeeded', 'completed'] } },
            orderBy: { paidAt: 'desc' },
            select: { id: true, amount: true },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feeInvoice.count({ where }),
    ]);

    const feeTypeIds = [...new Set(invoices.map((i) => i.feeTypeId))];
    const statusIds = [...new Set(invoices.map((i) => i.statusId))];
    const [feeTypes, statuses] = await Promise.all([
      this.prisma.feeType.findMany({ where: { id: { in: feeTypeIds } } }),
      this.prisma.lookupStatus.findMany({ where: { id: { in: statusIds } } }),
    ]);
    const feeTypeMap = new Map(feeTypes.map((f) => [f.id, f]));
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    return {
      data: invoices.map((inv) => ({
        ...this.toResponse(inv, feeTypeMap, statusMap),
        ...this.paymentSummary(inv),
        latestPaymentId: inv.payments[0]?.id ?? null,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(input: CreateFeeInvoiceInput, user: AuthUser) {
    const [student, feeType, pendingStatus] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
      }),
      this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } }),
      this.prisma.lookupStatus.findFirst({
        where: { code: 'pending', category: { code: 'fee_status' } },
      }),
    ]);

    if (!student) throw new BadRequestException('Invalid student for this branch');
    if (!feeType) throw new BadRequestException('Invalid fee type');
    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');

    const siblingDiscount = await this.computeSiblingDiscount(input.studentId, input.amount);
    const discount = (input.discount ?? 0) + siblingDiscount;
    const fine = input.fine ?? 0;
    const netAmount = input.amount - discount + fine;

    const invoiceNo = await this.nextDocumentNumber(input.branchId, 'INV');
    const invoice = await this.prisma.feeInvoice.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        feeTypeId: input.feeTypeId,
        invoiceNo,
        amount: input.amount,
        discount,
        fine,
        netAmount,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        statusId: pendingStatus.id,
        remarks: input.remarks,
        createdById: user.id,
      },
      include: { student: { select: { id: true, fullName: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoice.created',
      entityType: 'FeeInvoice',
      entityId: invoice.id,
      newValue: invoice,
    });

    const feeTypeMap = new Map([[feeType.id, feeType]]);
    const statusMap = new Map([[pendingStatus.id, pendingStatus]]);
    return {
      ...this.toResponse(invoice, feeTypeMap, statusMap),
      paidAmount: 0,
      remainingAmount: this.roundMoney(netAmount),
    };
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

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
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
      include: { student: { select: { id: true, fullName: true } } },
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
      include: { payments: { where: { status: { in: ['succeeded', 'completed'] } } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const feeTypeIds = [...new Set(invoices.map((i) => i.feeTypeId))];
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
    const feeType = await this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } });
    if (!feeType) throw new BadRequestException('Invalid fee type');

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
        program: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const structures = await this.loadFeeStructuresForBulk({
      branchId: input.branchId,
      feeTypeId: input.feeTypeId,
      feeStructureId: input.feeStructureId,
    });

    const overrideAmount =
      input.defaultAmount !== undefined ? this.roundMoney(input.defaultAmount) : null;

    const previewStudents = students.map((student) => {
      const structure = this.matchFeeStructureForStudent(structures, {
        batchId: student.batchId,
        programId: student.programId,
        feeStructureId: input.feeStructureId,
      });
      const structureAmount = structure ? this.roundMoney(Number(structure.amount)) : null;
      // Explicit override fills missing structures; does not replace matched rates.
      const suggestedAmount =
        structureAmount ?? overrideAmount;

      return {
        studentId: student.id,
        fullName: student.fullName,
        programId: student.programId,
        batchId: student.batchId,
        programName: student.program?.name ?? null,
        batchName: student.batch?.name ?? null,
        feeStructureId: structure?.id ?? null,
        defaultAmount: suggestedAmount,
        suggestedAmount,
        dueDayOfMonth: structure?.dueDayOfMonth ?? null,
      };
    });

    const matchedWithStructure = previewStudents.filter((s) => s.feeStructureId);
    const uniqueStructureIds = new Set(matchedWithStructure.map((s) => s.feeStructureId));
    const amounts = matchedWithStructure
      .map((s) => s.suggestedAmount)
      .filter((a): a is number => a !== null);
    const uniqueAmounts = new Set(amounts);

    return {
      feeType: { id: feeType.id, name: feeType.name, code: feeType.code },
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
    if (input.lines?.length) {
      return this.generateBulkInvoicesFromLines(input, user);
    }

    if (!input.batchId) {
      throw new BadRequestException(
        'Batch is required when generating without per-student lines; use preview lines for branch-wide runs',
      );
    }

    const students = await this.prisma.student.findMany({
      where: { branchId: input.branchId, batchId: input.batchId, deletedAt: null },
      select: { id: true, programId: true, batchId: true },
    });
    if (students.length === 0) throw new BadRequestException('No students in batch');

    if (!input.feeTypeId && !input.feeStructureIds?.length) {
      throw new BadRequestException('Fee type or fee structures are required');
    }

    const [pendingStatus, siblingInfo, branch, structures] = await Promise.all([
      this.prisma.lookupStatus.findFirst({
        where: { code: 'pending', category: { code: 'fee_status' } },
      }),
      this.loadSiblingDiscountContext(students.map((s) => s.id)),
      this.prisma.branch.findUnique({
        where: { id: input.branchId },
        select: { code: true },
      }),
      input.feeStructureIds?.length
        ? this.prisma.feeStructure.findMany({
            where: {
              id: { in: input.feeStructureIds },
              branchId: input.branchId,
              isActive: true,
            },
          })
        : this.loadFeeStructuresForBulk({
            branchId: input.branchId,
            feeTypeId: input.feeTypeId!,
          }),
    ]);

    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');
    if (structures.length === 0) throw new BadRequestException('No fee structures for batch');

    const dueDate = this.resolveBulkDueDate(input.dueDate);
    const year = new Date().getFullYear();
    const code = (branch?.code ?? 'BR').toUpperCase().slice(0, 8);
    const useExplicitStructures = Boolean(input.feeStructureIds?.length);

    type Row = {
      branchId: string;
      studentId: string;
      feeTypeId: string;
      invoiceNo: string;
      amount: number;
      discount: number;
      fine: number;
      netAmount: number;
      dueDate: Date;
      statusId: string;
      remarks: string | null;
      createdById: string;
    };

    const draft: Omit<Row, 'invoiceNo'>[] = [];
    for (const student of students) {
      const matched = useExplicitStructures
        ? structures
        : (() => {
            const one = this.matchFeeStructureForStudent(structures, {
              batchId: student.batchId,
              programId: student.programId,
            });
            return one ? [one] : [];
          })();

      for (const structure of matched) {
        const amount = this.roundMoney(Number(structure.amount));
        const siblingDiscount = siblingInfo.eligibleIds.has(student.id)
          ? Math.round((amount * siblingInfo.percent) / 100)
          : 0;
        draft.push({
          branchId: input.branchId,
          studentId: student.id,
          feeTypeId: structure.feeTypeId,
          amount,
          discount: siblingDiscount,
          fine: 0,
          netAmount: this.roundMoney(amount - siblingDiscount),
          dueDate: structure.dueDayOfMonth
            ? new Date(dueDate.getFullYear(), dueDate.getMonth(), structure.dueDayOfMonth)
            : dueDate,
          statusId: pendingStatus.id,
          remarks: siblingDiscount > 0 ? `Sibling discount applied: ${siblingDiscount}` : null,
          createdById: user.id,
        });
      }
    }

    if (draft.length === 0) {
      throw new BadRequestException('No fee structures matched students in batch');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.feeInvoice.count({ where: { branchId: input.branchId } });
      const rows: Row[] = draft.map((row, index) => ({
        ...row,
        invoiceNo: `INV-${code}-${year}-${String(existingCount + index + 1).padStart(5, '0')}`,
      }));
      await tx.feeInvoice.createMany({ data: rows });
      return rows.length;
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoices.bulk_generated',
      entityType: 'Batch',
      entityId: input.batchId,
      newValue: { count: created },
    });

    return { created };
  }

  private async generateBulkInvoicesFromLines(input: GenerateBulkInvoicesInput, user: AuthUser) {
    // Lines with include:false are ignored; amounts validated only for included students.
    if (!input.feeTypeId) throw new BadRequestException('Fee type is required');
    const feeType = await this.prisma.feeType.findUnique({ where: { id: input.feeTypeId } });
    if (!feeType) throw new BadRequestException('Invalid fee type');

    const selectedLines = (input.lines ?? []).filter((line) => line.include !== false);
    if (selectedLines.length === 0) {
      throw new BadRequestException('Select at least one student');
    }

    const studentIds = selectedLines.map((l) => l.studentId);

    const [scopeStudents, pendingStatus, structures, siblingInfo, branch] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          branchId: input.branchId,
          deletedAt: null,
          ...(input.batchId ? { batchId: input.batchId } : {}),
          id: { in: studentIds },
        },
        select: { id: true, programId: true, batchId: true },
      }),
      this.prisma.lookupStatus.findFirst({
        where: { code: 'pending', category: { code: 'fee_status' } },
      }),
      this.loadFeeStructuresForBulk({
        branchId: input.branchId,
        feeTypeId: input.feeTypeId,
      }),
      this.loadSiblingDiscountContext(studentIds),
      this.prisma.branch.findUnique({
        where: { id: input.branchId },
        select: { code: true },
      }),
    ]);

    const scopeStudentIds = new Set(scopeStudents.map((s) => s.id));
    for (const line of selectedLines) {
      if (!scopeStudentIds.has(line.studentId)) {
        throw new BadRequestException(
          input.batchId
            ? 'One or more students are not in the selected batch'
            : 'One or more students are invalid for this branch',
        );
      }
      if (this.roundMoney(line.amount) <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }
    }

    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');

    const studentById = new Map(scopeStudents.map((s) => [s.id, s]));
    const dueDate = this.resolveBulkDueDate(input.dueDate);
    const year = new Date().getFullYear();
    const code = (branch?.code ?? 'BR').toUpperCase().slice(0, 8);

    const created = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.feeInvoice.count({ where: { branchId: input.branchId } });

      const rows = selectedLines.map((line, index) => {
        const student = studentById.get(line.studentId)!;
        const structure = this.matchFeeStructureForStudent(structures, {
          batchId: student.batchId,
          programId: student.programId,
        });
        const amount = this.roundMoney(line.amount);
        const siblingDiscount = siblingInfo.eligibleIds.has(line.studentId)
          ? Math.round((amount * siblingInfo.percent) / 100)
          : 0;
        const netAmount = this.roundMoney(amount - siblingDiscount);
        const invoiceNo = `INV-${code}-${year}-${String(existingCount + index + 1).padStart(5, '0')}`;

        return {
          branchId: input.branchId,
          studentId: line.studentId,
          feeTypeId: input.feeTypeId!,
          invoiceNo,
          amount,
          discount: siblingDiscount,
          fine: 0,
          netAmount,
          dueDate: structure?.dueDayOfMonth
            ? new Date(dueDate.getFullYear(), dueDate.getMonth(), structure.dueDayOfMonth)
            : dueDate,
          statusId: pendingStatus.id,
          remarks: siblingDiscount > 0 ? `Sibling discount applied: ${siblingDiscount}` : null,
          createdById: user.id,
        };
      });

      await tx.feeInvoice.createMany({ data: rows });
      return rows.length;
    });

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoices.bulk_generated',
      entityType: input.batchId ? 'Batch' : 'Branch',
      entityId: input.batchId ?? input.branchId,
      newValue: { count: created, feeTypeId: input.feeTypeId },
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
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const [feeType, status, settings] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: invoice.feeTypeId } }),
      this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } }),
      this.prisma.institutionSettings.findFirst(),
    ]);
    const feeTypeMap = feeType ? new Map([[feeType.id, feeType]]) : new Map();
    const statusMap = status ? new Map([[status.id, status]]) : new Map();

    return {
      ...this.toResponse(invoice, feeTypeMap, statusMap),
      institutionName: settings?.name ?? 'Institution',
    };
  }

  private async computeSiblingDiscount(studentId: string, amount: number): Promise<number> {
    const { percent, eligibleIds } = await this.loadSiblingDiscountContext([studentId]);
    if (percent <= 0 || !eligibleIds.has(studentId)) return 0;
    return Math.round((amount * percent) / 100);
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

  async getInvoicePrintData(id: string, scope: BranchScope) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
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
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const [feeType, status, settings, template] = await Promise.all([
      this.prisma.feeType.findUnique({ where: { id: invoice.feeTypeId } }),
      this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } }),
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'fee_invoice',
          isActive: true,
          OR: [{ branchId: invoice.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);

    return {
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amount: Number(invoice.amount),
        discount: Number(invoice.discount),
        fine: Number(invoice.fine),
        netAmount: Number(invoice.netAmount),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        remarks: invoice.remarks,
        status: status ? { code: status.code, label: status.label } : null,
        feeType: feeType ? { name: feeType.name, code: feeType.code } : null,
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
    },
    feeTypeMap: Map<string, { id: string; name: string; code: string }>,
    statusMap: Map<string, { id: string; code: string; label: string }>,
  ) {
    return {
      id: invoice.id,
      branchId: invoice.branchId,
      studentId: invoice.studentId,
      student: invoice.student,
      feeTypeId: invoice.feeTypeId,
      feeType: feeTypeMap.get(invoice.feeTypeId) ?? null,
      invoiceNo: invoice.invoiceNo ?? null,
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
    };
  }
}
