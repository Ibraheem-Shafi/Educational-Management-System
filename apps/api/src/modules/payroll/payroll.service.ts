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
  MarkPayrollPaidInput,
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

function utcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isUtcWeekday(value: Date): boolean {
  const day = value.getUTCDay();
  return day !== 0 && day !== 6;
}

function weekdaysInMonth(year: number, month: number): number {
  const { from, to } = monthRange(year, month);
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isUtcWeekday(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function weekdayKeysInMonth(year: number, month: number): string[] {
  const { from, to } = monthRange(year, month);
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isUtcWeekday(cursor)) keys.push(utcDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function paidLeaveKeysForMonth(
  leaves: Array<{ fromDate: Date; toDate: Date }>,
  year: number,
  month: number,
): Set<string> {
  const weekdays = weekdayKeysInMonth(year, month);
  const keys = new Set<string>();
  for (const leave of leaves) {
    const fromKey = utcDateKey(leave.fromDate);
    const toKey = utcDateKey(leave.toDate);
    for (const key of weekdays) {
      if (key >= fromKey && key <= toKey) keys.add(key);
    }
  }
  return keys;
}

const STATUTORY_KINDS = new Set(['tax', 'eobi', 'provident_fund']);
const LWP_NAME = 'Leave without pay';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveComponentAmount(
  percentOfBasic: number | null,
  amount: number,
  fullBasic: number,
): number {
  if (percentOfBasic != null) {
    return roundMoney((fullBasic * percentOfBasic) / 100);
  }
  return roundMoney(amount);
}

function componentGroup(kind: string, name: string): 'allowance' | 'deduction' | 'statutory' | 'lwp' {
  if (name === LWP_NAME) return 'lwp';
  if (kind === 'allowance') return 'allowance';
  if (STATUTORY_KINDS.has(kind)) return 'statutory';
  return 'deduction';
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
    const isActive = input.isActive ?? true;

    const structure = await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await this.deactivateOtherActiveStructures(tx, input.userId, input.branchId);
      }

      return tx.salaryStructure.create({
        data: {
          userId: input.userId,
          branchId: input.branchId,
          basicSalary: decimal(input.basicSalary),
          effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
          effectiveTo: input.effectiveTo ? parseDate(input.effectiveTo, 'effectiveTo') : null,
          isActive,
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
      const willBeActive = input.isActive ?? existing.isActive;
      if (willBeActive) {
        await this.deactivateOtherActiveStructures(tx, existing.userId, existing.branchId, id);
      }

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
      ...(query.status
        ? { status: query.status }
        : query.excludeFinalized
          ? { status: { not: 'finalized' } }
          : {}),
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
      orderBy: { effectiveFrom: 'desc' },
    });

    const structuresByUser = new Map<string, (typeof structures)[number]>();
    for (const structure of structures) {
      if (!structuresByUser.has(structure.userId)) {
        structuresByUser.set(structure.userId, structure);
      }
    }
    const uniqueStructures = [...structuresByUser.values()];
    const userIds = uniqueStructures.map((s) => s.userId);

    const lines = await this.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { runId: id } });

      const [attendanceRecords, leaveRequests] = userIds.length
        ? await Promise.all([
            tx.attendanceRecord.findMany({
              where: {
                branchId: run.branchId,
                entityId: { in: userIds },
                entityType: { in: [...STAFF_ENTITY_TYPES] },
                date: { gte: from, lte: to },
              },
              select: { entityId: true, statusId: true, date: true },
            }),
            tx.leaveRequest.findMany({
              where: {
                kind: 'employee',
                status: 'approved',
                userId: { in: userIds },
                fromDate: { lte: to },
                toDate: { gte: from },
              },
              select: { userId: true, fromDate: true, toDate: true },
            }),
          ])
        : [[], []];

      const attendanceByUser = new Map<string, typeof attendanceRecords>();
      for (const record of attendanceRecords) {
        const list = attendanceByUser.get(record.entityId) ?? [];
        list.push(record);
        attendanceByUser.set(record.entityId, list);
      }

      const leavesByUser = new Map<string, typeof leaveRequests>();
      for (const leave of leaveRequests) {
        if (!leave.userId) continue;
        const list = leavesByUser.get(leave.userId) ?? [];
        list.push(leave);
        leavesByUser.set(leave.userId, list);
      }

      const created = [];
      for (const structure of uniqueStructures) {
        const records = attendanceByUser.get(structure.userId) ?? [];
        const paidLeaveDateKeys = paidLeaveKeysForMonth(
          leavesByUser.get(structure.userId) ?? [],
          run.year,
          run.month,
        );
        const paidLeaveDays = paidLeaveDateKeys.size;
        const attendanceNotMarked = records.length === 0;

        let presentDays = 0;
        let unpaidAbsentDays = 0;
        if (!attendanceNotMarked) {
          for (const record of records) {
            if (presentId && record.statusId === presentId) presentDays++;
            if (absentId && record.statusId === absentId && isUtcWeekday(record.date)) {
              const key = utcDateKey(record.date);
              if (!paidLeaveDateKeys.has(key)) unpaidAbsentDays++;
            }
          }
        }

        const workingDays = calendarWeekdays;
        const fullBasic = toNumber(structure.basicSalary);
        const lwpAmount =
          workingDays > 0 ? roundMoney((fullBasic * unpaidAbsentDays) / workingDays) : 0;

        let allowancesTotal = 0;
        let deductionsTotal = 0;
        const breakdown: Array<{
          kind: string;
          name: string;
          amount: number;
          percentOfBasic: number | null;
          group: 'allowance' | 'deduction' | 'statutory' | 'lwp';
        }> = [];

        for (const component of structure.components) {
          const percent =
            component.percentOfBasic != null ? toNumber(component.percentOfBasic) : null;
          const amount = resolveComponentAmount(percent, toNumber(component.amount), fullBasic);
          const group = componentGroup(component.kind, component.name);
          breakdown.push({
            kind: component.kind,
            name: component.name,
            amount,
            percentOfBasic: percent,
            group,
          });
          if (group === 'allowance') allowancesTotal += amount;
          else deductionsTotal += amount;
        }

        if (lwpAmount > 0) {
          breakdown.push({
            kind: 'deduction',
            name: LWP_NAME,
            amount: lwpAmount,
            percentOfBasic: null,
            group: 'lwp',
          });
          deductionsTotal += lwpAmount;
        }

        allowancesTotal = roundMoney(allowancesTotal);
        deductionsTotal = roundMoney(deductionsTotal);
        const netPay = roundMoney(fullBasic + allowancesTotal - deductionsTotal);

        const line = await tx.payrollLine.create({
          data: {
            runId: id,
            userId: structure.userId,
            basicSalary: decimal(fullBasic),
            allowancesTotal: decimal(allowancesTotal),
            deductionsTotal: decimal(deductionsTotal),
            adjustmentsTotal: decimal(0),
            netPay: decimal(netPay),
            attendancePresentDays: presentDays,
            attendanceAbsentDays: unpaidAbsentDays,
            workingDays,
            breakdown: {
              components: breakdown,
              fullBasicSalary: fullBasic,
              unpaidAbsentDays,
              paidLeaveDays,
              lwpAmount,
              attendanceNotMarked,
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

  async sendBackToDraft(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'pending_approval') {
      throw new BadRequestException('Only pending approval runs can be sent back to draft');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'draft', approvedById: null },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.sent_back',
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

  async markPaid(id: string, input: MarkPayrollPaidInput, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (run.status !== 'finalized') {
      throw new BadRequestException('Only finalized runs can be marked as paid');
    }
    if (run.paidAt) {
      throw new BadRequestException('This payroll run is already marked as paid');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { paidAt: new Date(), paymentMethod: input.paymentMethod },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.run.paid',
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

    const breakdown = this.parseBreakdown(line.breakdown);

    return {
      line: this.toLineResponse(line),
      run: {
        year: line.run.year,
        month: line.run.month,
        status: line.run.status,
        paidAt: line.run.paidAt?.toISOString() ?? null,
        paymentMethod: line.run.paymentMethod,
      },
      employee: {
        ...line.user,
        staffCode: formatStaffCode(line.user.id),
      },
      institution: institution ?? { name: 'Institution', logoUrl: null, address: null },
      components: breakdown.components,
      fullBasicSalary: breakdown.fullBasicSalary,
      unpaidAbsentDays: breakdown.unpaidAbsentDays,
      paidLeaveDays: breakdown.paidLeaveDays,
      lwpAmount: breakdown.lwpAmount,
      adjustmentReason: breakdown.adjustmentReason,
      attendanceNotMarked: breakdown.attendanceNotMarked,
      printLayout: await this.resolvePrintLayout(line.run.branchId),
    };
  }

  private async resolvePrintLayout(branchId: string) {
    const row = await this.prisma.printDocumentTemplate.findFirst({
      where: {
        type: 'salary_slip',
        isActive: true,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: { branchId: 'desc' },
    });
    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS.salary_slip;
    const stored =
      row?.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)
        ? (row.fields as Record<string, boolean>)
        : {};
    return {
      paperSize: row?.paperSize ?? 'a4',
      fields: { ...defaults, ...stored },
      headerText: row?.headerText ?? null,
      footerText: row?.footerText ?? null,
      name: row?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES.salary_slip,
    };
  }

  private async deactivateOtherActiveStructures(
    tx: Prisma.TransactionClient,
    userId: string,
    branchId: string,
    exceptId?: string,
  ) {
    await tx.salaryStructure.updateMany({
      where: {
        userId,
        branchId,
        isActive: true,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isActive: false },
    });
  }

  private parseBreakdown(value: Prisma.JsonValue | null | undefined) {
    const empty = {
      components: [] as Array<{
        kind: string;
        name: string;
        amount: number;
        percentOfBasic: number | null;
        group?: string;
      }>,
      fullBasicSalary: null as number | null,
      unpaidAbsentDays: null as number | null,
      paidLeaveDays: null as number | null,
      lwpAmount: null as number | null,
      adjustmentReason: null as string | null,
      attendanceNotMarked: false,
    };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return empty;
    const raw = value as Record<string, unknown>;
    let components = empty.components;
    if (Array.isArray(raw.components)) {
      components = raw.components
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          kind: String(c.kind ?? 'deduction'),
          name: String(c.name ?? ''),
          amount: Number(c.amount) || 0,
          percentOfBasic: c.percentOfBasic != null ? Number(c.percentOfBasic) : null,
          group: typeof c.group === 'string' ? c.group : undefined,
        }));
    } else {
      const allowances = Array.isArray(raw.allowances) ? raw.allowances : [];
      const deductions = Array.isArray(raw.deductions) ? raw.deductions : [];
      components = [
        ...allowances
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .map((c) => ({
            kind: 'allowance',
            name: String(c.name ?? ''),
            amount: Number(c.amount) || 0,
            percentOfBasic: null,
            group: 'allowance',
          })),
        ...deductions
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .map((c) => ({
            kind: 'deduction',
            name: String(c.name ?? ''),
            amount: Number(c.amount) || 0,
            percentOfBasic: null,
            group: 'deduction',
          })),
      ];
    }
    return {
      components,
      fullBasicSalary: typeof raw.fullBasicSalary === 'number' ? raw.fullBasicSalary : null,
      unpaidAbsentDays: typeof raw.unpaidAbsentDays === 'number' ? raw.unpaidAbsentDays : null,
      paidLeaveDays: typeof raw.paidLeaveDays === 'number' ? raw.paidLeaveDays : null,
      lwpAmount: typeof raw.lwpAmount === 'number' ? raw.lwpAmount : null,
      adjustmentReason: typeof raw.adjustmentReason === 'string' ? raw.adjustmentReason : null,
      attendanceNotMarked: raw.attendanceNotMarked === true,
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
    paidAt?: Date | null;
    paymentMethod?: string | null;
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
      paidAt: run.paidAt?.toISOString() ?? null,
      paymentMethod: run.paymentMethod ?? null,
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
    paidAt?: Date | null;
    paymentMethod?: string | null;
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
