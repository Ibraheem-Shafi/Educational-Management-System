import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, FeesRevenueTrendResponse, FeesStatsResponse, PaginatedResponse } from '@eims/types';
import type {
  CreateFeeInvoiceInput,
  ListFeeInvoicesQuery,
  RecordPaymentInput,
  RecordFeePaymentInput,
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  ListFeeStructuresQuery,
  GenerateBulkInvoicesInput,
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
} from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
    private readonly accountingPosting: AccountingPostingService,
  ) {}

  async getStats(branchId: string | null): Promise<FeesStatsResponse> {
    const cacheKey = `fees:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<FeesStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
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

  async getRevenueTrend(branchId: string | null): Promise<FeesRevenueTrendResponse> {
    const cacheKey = `fees:revenue-trend:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<FeesRevenueTrendResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
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

  async listTypes() {
    const types = await this.prisma.feeType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { data: types };
  }

  async findAll(query: ListFeeInvoicesQuery, branchId: string | null): Promise<PaginatedResponse<Record<string, unknown>>> {
    const effectiveBranchId = branchId ?? query.branchId;
    await this.applyLateFeesToOverdue(effectiveBranchId ?? undefined);

    const where = {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where,
        include: { student: { select: { id: true, fullName: true } } },
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
      data: invoices.map((inv) => this.toResponse(inv, feeTypeMap, statusMap)),
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

    const invoice = await this.prisma.feeInvoice.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        feeTypeId: input.feeTypeId,
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
    return this.toResponse(invoice, feeTypeMap, statusMap);
  }

  async recordPayment(id: string, input: RecordPaymentInput, user: AuthUser, branchId: string | null) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
      include: { payments: { where: { status: 'succeeded' } } },
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
      },
      user,
      branchId,
      { provider: 'manual' },
    );
  }

  async recordFeePayment(
    id: string,
    input: RecordFeePaymentInput,
    user: AuthUser,
    branchId: string | null,
    options?: { provider?: string; providerRef?: string; status?: string; skipAudit?: boolean },
  ) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
      include: {
        student: { select: { id: true, fullName: true } },
        payments: { where: { status: 'succeeded' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const currentStatus = await this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } });
    if (currentStatus?.code === 'waived') {
      throw new BadRequestException('Cannot record payment on waived invoice');
    }

    const remaining = this.getRemainingAmount(invoice);
    if (input.amount > remaining) {
      throw new BadRequestException(`Payment amount exceeds remaining balance (${remaining})`);
    }

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    const status = options?.status ?? 'succeeded';

    const payment = await this.prisma.feePayment.create({
      data: {
        invoiceId: id,
        branchId: invoice.branchId,
        amount: input.amount,
        method: input.method,
        provider: options?.provider ?? 'manual',
        providerRef: options?.providerRef,
        status,
        paidAt: status === 'succeeded' ? paidAt : null,
        recordedById: user.id,
      },
    });

    const updated = await this.syncInvoiceAfterPayment(id);

    if (status === 'succeeded') {
      await this.accountingPosting.postFeePayment(
        payment.id,
        invoice.branchId,
        Number(input.amount),
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
      include: { payments: { where: { status: 'succeeded' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidTotal = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const netAmount = Number(invoice.netAmount);
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

  async getInvoiceRemainingAmount(id: string, branchId: string | null): Promise<number> {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
      include: { payments: { where: { status: 'succeeded' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.getRemainingAmount(invoice);
  }

  private getRemainingAmount(invoice: {
    netAmount: { toString(): string };
    payments?: Array<{ amount: { toString(): string } }>;
  }): number {
    const paid = (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return Math.max(0, Number(invoice.netAmount) - paid);
  }

  private async getFeeStatusMap(): Promise<Map<string, string>> {
    const statuses = await this.prisma.lookupStatus.findMany({
      where: { category: { code: 'fee_status' } },
    });
    return new Map(statuses.map((s) => [s.code, s.id]));
  }

  async getStudentFees(studentId: string, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId },
      include: { payments: { where: { status: 'succeeded' } } },
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
      invoices: invoices.map((inv) => this.toResponse(inv, feeTypeMap, statusMap)),
    };
  }

  async listStructures(query: ListFeeStructuresQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const structures = await this.prisma.feeStructure.findMany({
      where: {
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        isActive: true,
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

  async updateStructure(id: string, input: UpdateFeeStructureInput, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.feeStructure.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
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

  async deleteStructure(id: string, user: AuthUser, branchId: string | null) {
    return this.updateStructure(id, { isActive: false }, user, branchId);
  }

  async generateBulkInvoices(input: GenerateBulkInvoicesInput, user: AuthUser) {
    const students = await this.prisma.student.findMany({
      where: { branchId: input.branchId, batchId: input.batchId, deletedAt: null },
      select: { id: true },
    });
    if (students.length === 0) throw new BadRequestException('No students in batch');

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        branchId: input.branchId,
        isActive: true,
        OR: [{ batchId: input.batchId }, { batchId: null }],
        ...(input.feeStructureIds?.length ? { id: { in: input.feeStructureIds } } : {}),
      },
    });
    if (structures.length === 0) throw new BadRequestException('No fee structures for batch');

    const pendingStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'pending', category: { code: 'fee_status' } },
    });
    if (!pendingStatus) throw new BadRequestException('Fee status lookup not configured');

    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : (() => {
          const d = new Date();
          d.setMonth(d.getMonth() + 1);
          d.setDate(1);
          return d;
        })();

    let created = 0;
    for (const student of students) {
      for (const structure of structures) {
        const siblingDiscount = await this.computeSiblingDiscount(student.id, Number(structure.amount));
        const amount = Number(structure.amount);
        const netAmount = amount - siblingDiscount;

        await this.prisma.feeInvoice.create({
          data: {
            branchId: input.branchId,
            studentId: student.id,
            feeTypeId: structure.feeTypeId,
            amount,
            discount: siblingDiscount,
            fine: 0,
            netAmount,
            dueDate: structure.dueDayOfMonth
              ? new Date(dueDate.getFullYear(), dueDate.getMonth(), structure.dueDayOfMonth)
              : dueDate,
            statusId: pendingStatus.id,
            remarks: siblingDiscount > 0 ? `Sibling discount applied: ${siblingDiscount}` : null,
            createdById: user.id,
          },
        });
        created++;
      }
    }

    await this.audit.log({
      userId: user.id,
      action: 'fee_invoices.bulk_generated',
      entityType: 'Batch',
      entityId: input.batchId,
      newValue: { count: created },
    });

    return { created };
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

    const updated = await this.prisma.feeType.update({
      where: { id },
      data: input,
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

  async getInvoice(id: string, branchId: string | null) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
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
    const settings = await this.prisma.institutionSettings.findFirst();
    const percent = settings?.siblingDiscountPercent ? Number(settings.siblingDiscountPercent) : 0;
    if (percent <= 0) return 0;

    const parentLinks = await this.prisma.studentParent.findMany({
      where: { studentId },
      select: { parentId: true },
    });
    if (parentLinks.length === 0) return 0;

    const parentIds = parentLinks.map((p) => p.parentId);
    const siblings = await this.prisma.studentParent.findMany({
      where: { parentId: { in: parentIds }, studentId: { not: studentId } },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    if (siblings.length === 0) return 0;

    return Math.round((amount * percent) / 100);
  }

  private async applyLateFeesToOverdue(branchId?: string) {
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
        ...(branchId ? { branchId } : {}),
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

  private toResponse(
    invoice: {
      id: string;
      branchId: string;
      studentId: string;
      feeTypeId: string;
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
