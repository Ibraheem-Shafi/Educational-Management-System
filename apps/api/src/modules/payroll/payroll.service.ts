import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { paginatedResult } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import type { AuthUser } from '@eims/types';
import type {
  AdjustPayrollLineInput,
  CreatePayrollRunInput,
  CreateSalaryStructureInput,
  ExportPayrollRunQuery,
  ListPayrollRunsQuery,
  ListSalaryStructuresQuery,
  UpdateSalaryStructureInput,
} from '@eims/shared';

const STAFF_ENTITY_TYPES = ['staff', 'teacher', 'user'] as const;

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return date;
}

function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  };
}

function weekdaysInMonth(year: number, month: number): number {
  const { from, to } = monthRange(year, month);
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function formatStaffCode(id: string): string {
  return `STF-${id.slice(-6).toUpperCase()}`;
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookupCache: LookupCacheService,
    private readonly accountingPosting: AccountingPostingService,
  ) {}

  // --- Salary structures ---

  async findStructures(query: ListSalaryStructuresQuery, scope: BranchScope) {
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [structures, total] = await Promise.all([
      this.prisma.salaryStructure.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true } },
          components: { orderBy: { kind: 'asc' } },
        },
        orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salaryStructure.count({ where }),
    ]);

    return paginatedResult(structures.map(this.toStructureResponse), total, page, limit);
  }

  async findStructure(id: string, scope: BranchScope) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: {
        user: { select: { id: true, fullName: true } },
        components: { orderBy: { kind: 'asc' } },
      },
    });
    if (!structure) throw new NotFoundException('Salary structure not found');
    return this.toStructureResponse(structure);
  }

  async createStructure(input: CreateSalaryStructureInput, user: AuthUser) {
    await this.assertUserInBranch(input.userId, input.branchId);

    const structure = await this.prisma.salaryStructure.create({
      data: {
        userId: input.userId,
        branchId: input.branchId,
        basicSalary: decimal(input.basicSalary),
        effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
        effectiveTo: input.effectiveTo ? parseDate(input.effectiveTo, 'effectiveTo') : null,
        isActive: input.isActive ?? true,
        components: {
          create: input.components.map((c) => ({
            kind: c.kind,
            name: c.name,
            amount: decimal(c.amount),
            percentOfBasic: c.percentOfBasic != null ? decimal(c.percentOfBasic) : null,
          })),
        },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        components: true,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.structure.created',
      entityType: 'SalaryStructure',
      entityId: structure.id,
      newValue: structure,
    });

    return this.toStructureResponse(structure);
  }

  async updateStructure(
    id: string,
    input: UpdateSalaryStructureInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.salaryStructure.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { components: true },
    });
    if (!existing) throw new NotFoundException('Salary structure not found');

    const structure = await this.prisma.$transaction(async (tx) => {
      if (input.components !== undefined) {
        await tx.salaryComponent.deleteMany({ where: { structureId: id } });
      }

      return tx.salaryStructure.update({
        where: { id },
        data: {
          ...(input.basicSalary !== undefined
            ? { basicSalary: decimal(input.basicSalary) }
            : {}),
          ...(input.effectiveFrom !== undefined
            ? { effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom') }
            : {}),
          ...(input.effectiveTo !== undefined
            ? {
                effectiveTo: input.effectiveTo
                  ? parseDate(input.effectiveTo, 'effectiveTo')
                  : null,
              }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.components !== undefined
            ? {
                components: {
                  create: input.components.map((c) => ({
                    kind: c.kind,
                    name: c.name,
                    amount: decimal(c.amount),
                    percentOfBasic:
                      c.percentOfBasic != null ? decimal(c.percentOfBasic) : null,
                  })),
                },
              }
            : {}),
        },
        include: {
          user: { select: { id: true, fullName: true } },
          components: true,
        },
      });
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.structure.updated',
      entityType: 'SalaryStructure',
      entityId: id,
      previousValue: existing,
      newValue: structure,
    });

    return this.toStructureResponse(structure);
  }

  async removeStructure(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.salaryStructure.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Salary structure not found');

    await this.prisma.salaryStructure.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.structure.deleted',
      entityType: 'SalaryStructure',
      entityId: id,
      previousValue: existing,
    });

    return { success: true };
  }

  // --- Payroll runs ---

  async findRuns(query: ListPayrollRunsQuery, scope: BranchScope) {
    const where = {
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.year !== undefined ? { year: query.year } : {}),
      ...(query.month !== undefined ? { month: query.month } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [runs, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        include: {
          _count: { select: { lines: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    return paginatedResult(runs.map(this.toRunSummary), total, page, limit);
  }

  async findRun(id: string, scope: BranchScope) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        lines: {
          include: {
            user: { select: { id: true, fullName: true } },
          },
          orderBy: { user: { fullName: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return this.toRunDetail(run);
  }

  async createRun(input: CreatePayrollRunInput, user: AuthUser) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: {
          branchId: input.branchId,
          year: input.year,
          month: input.month,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Payroll run already exists for this branch and period');
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        branchId: input.branchId,
        year: input.year,
        month: input.month,
        notes: input.notes ?? null,
        status: 'draft',
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.created',
      entityType: 'PayrollRun',
      entityId: run.id,
      newValue: run,
    });

    return this.toRunSummary(run);
  }

  async generateRun(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'draft') {
      throw new BadRequestException('Only draft runs can be generated');
    }

    const { from, to } = monthRange(run.year, run.month);
    const calendarWeekdays = weekdaysInMonth(run.year, run.month);

    const [presentId, absentId] = await Promise.all([
      this.lookupCache.getStatusId('attendance_status', 'present'),
      this.lookupCache.getStatusId('attendance_status', 'absent'),
    ]);

    const structures = await this.prisma.salaryStructure.findMany({
      where: {
        branchId: run.branchId,
        deletedAt: null,
        isActive: true,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      include: { components: true },
    });

    const lines = await this.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { runId: id } });

      const created = [];
      for (const structure of structures) {
        const attendanceRecords = await tx.attendanceRecord.findMany({
          where: {
            branchId: run.branchId,
            entityId: structure.userId,
            entityType: { in: [...STAFF_ENTITY_TYPES] },
            date: { gte: from, lte: to },
          },
          select: { statusId: true },
        });

        let presentDays = 0;
        let absentDays = 0;
        for (const record of attendanceRecords) {
          if (presentId && record.statusId === presentId) presentDays++;
          else if (absentId && record.statusId === absentId) absentDays++;
        }

        const trackedDays = presentDays + absentDays;
        const workingDays = trackedDays > 0 ? trackedDays : calendarWeekdays;
        const basic = toNumber(structure.basicSalary);
        const attendanceRatio = workingDays > 0 ? presentDays / workingDays : 0;
        const proratedBasic = basic * attendanceRatio;

        let allowancesTotal = 0;
        let deductionsTotal = 0;
        const breakdown: Array<{
          kind: string;
          name: string;
          amount: number;
          percentOfBasic: number | null;
        }> = [];

        for (const component of structure.components) {
          const baseAmount =
            component.percentOfBasic != null
              ? (proratedBasic * toNumber(component.percentOfBasic)) / 100
              : toNumber(component.amount) * attendanceRatio;

          const rounded = Math.round(baseAmount * 100) / 100;
          breakdown.push({
            kind: component.kind,
            name: component.name,
            amount: rounded,
            percentOfBasic:
              component.percentOfBasic != null ? toNumber(component.percentOfBasic) : null,
          });

          if (component.kind === 'allowance') allowancesTotal += rounded;
          else deductionsTotal += rounded;
        }

        allowancesTotal = Math.round(allowancesTotal * 100) / 100;
        deductionsTotal = Math.round(deductionsTotal * 100) / 100;
        const netPay = Math.round((proratedBasic + allowancesTotal - deductionsTotal) * 100) / 100;

        const line = await tx.payrollLine.create({
          data: {
            runId: id,
            userId: structure.userId,
            basicSalary: decimal(proratedBasic),
            allowancesTotal: decimal(allowancesTotal),
            deductionsTotal: decimal(deductionsTotal),
            adjustmentsTotal: decimal(0),
            netPay: decimal(netPay),
            attendancePresentDays: presentDays,
            attendanceAbsentDays: absentDays,
            workingDays,
            breakdown: {
              components: breakdown,
              fullBasicSalary: basic,
              attendanceRatio,
            },
          },
        });
        created.push(line);
      }
      return created;
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.generated',
      entityType: 'PayrollRun',
      entityId: id,
      newValue: { lineCount: lines.length },
    });

    return this.findRun(id, scope);
  }

  async adjustLine(
    id: string,
    input: AdjustPayrollLineInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const line = await this.prisma.payrollLine.findFirst({
      where: { id, run: { ...prismaBranchFilter(scope) } },
      include: { run: true },
    });
    if (!line) throw new NotFoundException('Payroll line not found');
    if (line.run.status !== 'draft') {
      throw new BadRequestException('Only lines on draft runs can be adjusted');
    }

    const basic = toNumber(line.basicSalary);
    const allowances = toNumber(line.allowancesTotal);
    const deductions = toNumber(line.deductionsTotal);
    const adjustments = input.adjustmentsTotal;
    const netPay = Math.round((basic + allowances - deductions + adjustments) * 100) / 100;

    const existingBreakdown =
      line.breakdown && typeof line.breakdown === 'object' && !Array.isArray(line.breakdown)
        ? (line.breakdown as Record<string, unknown>)
        : {};

    const updated = await this.prisma.payrollLine.update({
      where: { id },
      data: {
        adjustmentsTotal: decimal(adjustments),
        netPay: decimal(netPay),
        breakdown: {
          ...existingBreakdown,
          adjustmentReason: input.reason ?? null,
        },
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.line.adjusted',
      entityType: 'PayrollLine',
      entityId: id,
      previousValue: line,
      newValue: updated,
    });

    return this.toLineResponse(updated);
  }

  async submitApproval(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'draft') {
      throw new BadRequestException('Only draft runs can be submitted for approval');
    }

    const lineCount = await this.prisma.payrollLine.count({ where: { runId: id } });
    if (lineCount === 0) {
      throw new BadRequestException('Generate payroll lines before submitting for approval');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'pending_approval' },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.submitted',
      entityType: 'PayrollRun',
      entityId: id,
      previousValue: run,
      newValue: updated,
    });

    return this.toRunSummary(updated);
  }

  async approveRun(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'pending_approval') {
      throw new BadRequestException('Only pending approval runs can be approved');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'approved', approvedById: user.id },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.approved',
      entityType: 'PayrollRun',
      entityId: id,
      previousValue: run,
      newValue: updated,
    });

    return this.toRunSummary(updated);
  }

  async finalizeRun(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'approved') {
      throw new BadRequestException('Only approved runs can be finalized');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'finalized', finalizedAt: new Date() },
      include: { lines: true },
    });

    const totalNet = updated.lines.reduce((sum, line) => sum + Number(line.netPay), 0);
    if (totalNet > 0) {
      await this.accountingPosting.postPayrollRun(id, updated.branchId, totalNet, user.id);
    }

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.finalized',
      entityType: 'PayrollRun',
      entityId: id,
      previousValue: run,
      newValue: updated,
    });

    return this.toRunSummary(updated);
  }

  async exportRun(id: string, query: ExportPayrollRunQuery, scope: BranchScope) {
    const run = await this.findRun(id, scope);
    const rows = run.lines.map((line) => ({
      staffCode: line.user ? formatStaffCode(line.user.id) : '',
      fullName: line.user?.fullName ?? '',
      basicSalary: line.basicSalary,
      allowancesTotal: line.allowancesTotal,
      deductionsTotal: line.deductionsTotal,
      adjustmentsTotal: line.adjustmentsTotal,
      netPay: line.netPay,
      presentDays: line.attendancePresentDays,
      absentDays: line.attendanceAbsentDays,
      workingDays: line.workingDays,
    }));

    if (query.format === 'json') {
      return { data: rows, run: { year: run.year, month: run.month, status: run.status } };
    }

    const headers = [
      'Staff Code',
      'Full Name',
      'Basic Salary',
      'Allowances',
      'Deductions',
      'Adjustments',
      'Net Pay',
      'Present Days',
      'Absent Days',
      'Working Days',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          this.csvEscape(r.staffCode),
          this.csvEscape(r.fullName),
          r.basicSalary,
          r.allowancesTotal,
          r.deductionsTotal,
          r.adjustmentsTotal,
          r.netPay,
          r.presentDays,
          r.absentDays,
          r.workingDays,
        ].join(','),
      ),
    ];
    return { csv: csvLines.join('\n'), filename: `payroll-${run.year}-${String(run.month).padStart(2, '0')}.csv` };
  }

  async getLinePrintData(id: string, scope: BranchScope) {
    const line = await this.prisma.payrollLine.findFirst({
      where: { id, run: { ...prismaBranchFilter(scope) } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            department: true,
            branch: { select: { id: true, name: true } },
          },
        },
        run: true,
      },
    });
    if (!line) throw new NotFoundException('Payroll line not found');

    const institution = await this.prisma.institutionSettings.findFirst({
      select: { name: true, logoUrl: true, address: true },
    });

    const breakdown =
      line.breakdown && typeof line.breakdown === 'object' && !Array.isArray(line.breakdown)
        ? (line.breakdown as { components?: Array<{ kind: string; name: string; amount: number }> })
        : {};

    return {
      line: this.toLineResponse(line),
      run: {
        year: line.run.year,
        month: line.run.month,
        status: line.run.status,
      },
      employee: {
        ...line.user,
        staffCode: formatStaffCode(line.user.id),
      },
      institution: institution ?? { name: 'Institution', logoUrl: null, address: null },
      components: breakdown.components ?? [],
    };
  }

  private csvEscape(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private async getRunOrThrow(id: string, scope: BranchScope) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  private async assertUserInBranch(userId: string, branchId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, branchId },
    });
    if (!target) throw new NotFoundException('User not found in branch');
  }

  private toStructureResponse(structure: {
    id: string;
    userId: string;
    branchId: string;
    basicSalary: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; fullName: string };
    components: Array<{
      id: string;
      kind: string;
      name: string;
      amount: Prisma.Decimal;
      percentOfBasic: Prisma.Decimal | null;
    }>;
  }) {
    return {
      id: structure.id,
      userId: structure.userId,
      branchId: structure.branchId,
      basicSalary: toNumber(structure.basicSalary),
      effectiveFrom: structure.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: structure.effectiveTo?.toISOString().slice(0, 10) ?? null,
      isActive: structure.isActive,
      user: structure.user
        ? { ...structure.user, staffCode: formatStaffCode(structure.user.id) }
        : undefined,
      components: structure.components.map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        amount: toNumber(c.amount),
        percentOfBasic: c.percentOfBasic != null ? toNumber(c.percentOfBasic) : null,
      })),
      createdAt: structure.createdAt.toISOString(),
      updatedAt: structure.updatedAt.toISOString(),
    };
  }

  private toRunSummary(run: {
    id: string;
    branchId: string;
    year: number;
    month: number;
    status: string;
    approvedById: string | null;
    finalizedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { lines: number };
  }) {
    return {
      id: run.id,
      branchId: run.branchId,
      year: run.year,
      month: run.month,
      status: run.status,
      approvedById: run.approvedById,
      finalizedAt: run.finalizedAt?.toISOString() ?? null,
      notes: run.notes,
      lineCount: run._count?.lines ?? undefined,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  private toLineResponse(line: {
    id: string;
    runId: string;
    userId: string;
    basicSalary: Prisma.Decimal;
    allowancesTotal: Prisma.Decimal;
    deductionsTotal: Prisma.Decimal;
    adjustmentsTotal: Prisma.Decimal;
    netPay: Prisma.Decimal;
    attendancePresentDays: number;
    attendanceAbsentDays: number;
    workingDays: number;
    breakdown: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; fullName: string };
  }) {
    return {
      id: line.id,
      runId: line.runId,
      userId: line.userId,
      basicSalary: toNumber(line.basicSalary),
      allowancesTotal: toNumber(line.allowancesTotal),
      deductionsTotal: toNumber(line.deductionsTotal),
      adjustmentsTotal: toNumber(line.adjustmentsTotal),
      netPay: toNumber(line.netPay),
      attendancePresentDays: line.attendancePresentDays,
      attendanceAbsentDays: line.attendanceAbsentDays,
      workingDays: line.workingDays,
      breakdown: line.breakdown,
      user: line.user ? { ...line.user, staffCode: formatStaffCode(line.user.id) } : undefined,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    };
  }

  private toRunDetail(run: {
    id: string;
    branchId: string;
    year: number;
    month: number;
    status: string;
    approvedById: string | null;
    finalizedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      runId: string;
      userId: string;
      basicSalary: Prisma.Decimal;
      allowancesTotal: Prisma.Decimal;
      deductionsTotal: Prisma.Decimal;
      adjustmentsTotal: Prisma.Decimal;
      netPay: Prisma.Decimal;
      attendancePresentDays: number;
      attendanceAbsentDays: number;
      workingDays: number;
      breakdown: Prisma.JsonValue;
      createdAt: Date;
      updatedAt: Date;
      user: { id: string; fullName: string };
    }>;
  }) {
    return {
      ...this.toRunSummary(run),
      lines: run.lines.map((line) => this.toLineResponse(line)),
    };
  }
}
