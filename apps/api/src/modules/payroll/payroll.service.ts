import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import {
  computeSalarySheetLine,
  DEFAULT_EXTRA_LEC_RATE,
  inferStaffGroup,
  PAYROLL_WORKING_DAYS,
  staffGroups,
} from '@eims/shared';
import type { StaffGroup, UpdatePayrollLineInput } from '@eims/shared';
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
  BulkSavePayrollLinesInput,
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

function parseOptionalDate(value: string | null | undefined, field: string): Date | null {
  if (value == null || value === '') return null;
  return parseDate(value, field);
}

function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  };
}

function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
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

function asStaffGroup(value: string | null | undefined): StaffGroup {
  if (value && staffGroups.includes(value as StaffGroup)) return value as StaffGroup;
  return 'permanent';
}

function displayRunStatus(run: { status: string; paidAt?: Date | null }): 'open' | 'paid' {
  if (run.paidAt || run.status === 'paid') return 'paid';
  return 'open';
}

function isRunPaid(run: { status: string; paidAt?: Date | null }): boolean {
  return displayRunStatus(run) === 'paid';
}

type SheetLineInput = {
  staffGroup: StaffGroup;
  basicSalary: number;
  absents: number;
  extraLectures: number;
  extraLecRate: number;
  lectureCount: number;
  ratePerClass: number;
  otherAllowance: number;
  advanceDeduction: number;
  securityDeduct: number;
  eobi: number;
  pessi: number;
  previousAdvance: number;
  currentAdvance: number;
  securityPrevious: number;
};

function sheetData(input: SheetLineInput) {
  const computed = computeSalarySheetLine(input);
  return {
    staffGroup: input.staffGroup,
    basicSalary: decimal(input.basicSalary),
    allowancesTotal: decimal(computed.allowancesTotal),
    deductionsTotal: decimal(computed.deductionsTotal),
    adjustmentsTotal: decimal(0),
    netPay: decimal(computed.netPay),
    attendanceAbsentDays: input.absents,
    workingDays: computed.workingDays,
    absents: input.absents,
    deductedDays: computed.deductedDays,
    extraLectures: input.extraLectures,
    lectureCount: input.lectureCount,
    ratePerClass: decimal(input.ratePerClass),
    extraLecRate: decimal(input.extraLecRate),
    extraLecAmount: decimal(computed.extraLecAmount),
    lecturesAmount: decimal(computed.lecturesAmount),
    otherAllowance: decimal(input.otherAllowance),
    absentFine: decimal(computed.absentFine),
    advanceDeduction: decimal(input.advanceDeduction),
    securityDeduct: decimal(input.securityDeduct),
    eobi: decimal(input.eobi),
    pessi: decimal(input.pessi),
    previousAdvance: decimal(input.previousAdvance),
    currentAdvance: decimal(input.currentAdvance),
    pendingAdvance: decimal(computed.pendingAdvance),
    securityPrevious: decimal(input.securityPrevious),
    securityTillDate: decimal(computed.securityTillDate),
    breakdown: {
      perDay: computed.perDay,
      entitlementsTotal: computed.entitlementsTotal,
      extraLecAmount: computed.extraLecAmount,
      lecturesAmount: computed.lecturesAmount,
    },
  };
}

const lineUserSelect = { id: true, fullName: true, designation: true } as const;

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lookupCache: LookupCacheService,
    private readonly accountingPosting: AccountingPostingService,
  ) {}

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
          user: { select: lineUserSelect },
          components: { orderBy: { kind: 'asc' } },
        },
        orderBy: [{ isActive: 'desc' }, { staffGroup: 'asc' }, { effectiveFrom: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salaryStructure.count({ where }),
    ]);

    return paginatedResult(structures.map((s) => this.toStructureResponse(s)), total, page, limit);
  }

  async findStructure(id: string, scope: BranchScope) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: {
        user: { select: lineUserSelect },
        components: { orderBy: { kind: 'asc' } },
      },
    });
    if (!structure) throw new NotFoundException('Salary structure not found');
    return this.toStructureResponse(structure);
  }

  async createStructure(input: CreateSalaryStructureInput, user: AuthUser) {
    await this.assertUserInBranch(input.userId, input.branchId);
    const isActive = input.isActive ?? true;
    const staff = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { designation: true },
    });
    const staffGroup = input.staffGroup ?? inferStaffGroup(staff?.designation);

    const structure = await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await this.deactivateOtherActiveStructures(tx, input.userId, input.branchId);
      }

      return tx.salaryStructure.create({
        data: {
          userId: input.userId,
          branchId: input.branchId,
          basicSalary: decimal(input.basicSalary),
          staffGroup,
          bankAccount: input.bankAccount ?? null,
          eobi: decimal(input.eobi ?? 0),
          pessi: decimal(input.pessi ?? 0),
          extraLecRate: decimal(input.extraLecRate ?? DEFAULT_EXTRA_LEC_RATE),
          ratePerClass: decimal(input.ratePerClass ?? 0),
          effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
          effectiveTo: input.effectiveTo ? parseDate(input.effectiveTo, 'effectiveTo') : null,
          isActive,
          components: {
            create: (input.components ?? []).map((c) => ({
              kind: c.kind,
              name: c.name,
              amount: decimal(c.amount),
              percentOfBasic: c.percentOfBasic != null ? decimal(c.percentOfBasic) : null,
            })),
          },
        },
        include: {
          user: { select: lineUserSelect },
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
          ...(input.basicSalary !== undefined ? { basicSalary: decimal(input.basicSalary) } : {}),
          ...(input.staffGroup !== undefined ? { staffGroup: input.staffGroup } : {}),
          ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
          ...(input.eobi !== undefined ? { eobi: decimal(input.eobi) } : {}),
          ...(input.pessi !== undefined ? { pessi: decimal(input.pessi) } : {}),
          ...(input.extraLecRate !== undefined ? { extraLecRate: decimal(input.extraLecRate) } : {}),
          ...(input.ratePerClass !== undefined ? { ratePerClass: decimal(input.ratePerClass) } : {}),
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
          user: { select: lineUserSelect },
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

  async findRuns(query: ListPayrollRunsQuery, scope: BranchScope) {
    const statusFilter = this.runStatusWhere(query.status, query.excludeFinalized);
    const where = {
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.year !== undefined ? { year: query.year } : {}),
      ...(query.month !== undefined ? { month: query.month } : {}),
      ...statusFilter,
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

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

    return paginatedResult(runs.map((run) => this.toRunSummary(run)), total, page, limit);
  }

  async findRun(id: string, scope: BranchScope) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: {
        lines: {
          include: {
            user: { select: lineUserSelect },
          },
          orderBy: [{ staffGroup: 'asc' }, { user: { fullName: 'asc' } }],
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    const branch = await this.prisma.branch.findFirst({
      where: { id: run.branchId },
      select: { id: true, name: true },
    });
    return this.toRunDetail(run, branch);
  }

  async createRun(input: CreatePayrollRunInput, user: AuthUser, scope: BranchScope) {
    return this.openMonth(input, user, scope);
  }

  async openMonth(input: CreatePayrollRunInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: {
          branchId: input.branchId,
          year: input.year,
          month: input.month,
        },
      },
    });

    let run = existing;
    if (!run) {
      run = await this.prisma.payrollRun.create({
        data: {
          branchId: input.branchId,
          year: input.year,
          month: input.month,
          notes: input.notes ?? null,
          status: 'open',
        },
      });
      await this.audit.log({
        userId: user.id,
        action: 'payroll.month.opened',
        entityType: 'PayrollRun',
        entityId: run.id,
        newValue: run,
      });
    } else if (input.notes && !run.notes) {
      run = await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { notes: input.notes },
      });
    }

    if (!isRunPaid(run)) {
      await this.fillMissingLines(run.id, user, scope);
    }

    return this.findRun(run.id, scope);
  }

  async generateRun(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (isRunPaid(run)) {
      throw new BadRequestException('Paid salary sheets cannot be regenerated');
    }
    await this.fillMissingLines(id, user, scope);
    return this.findRun(id, scope);
  }

  async updateLine(
    id: string,
    input: UpdatePayrollLineInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const line = await this.prisma.payrollLine.findFirst({
      where: { id, run: { ...prismaBranchFilter(scope) } },
      include: { run: true, user: { select: lineUserSelect } },
    });
    if (!line) throw new NotFoundException('Payroll line not found');
    if (isRunPaid(line.run)) {
      throw new BadRequestException('Paid salary sheets cannot be edited');
    }

    const next = this.mergeLineInput(line, input);
    const updated = await this.prisma.payrollLine.update({
      where: { id },
      data: {
        ...sheetData(next),
        designation: next.designation,
        accountNumber: next.accountNumber,
        remarks: next.remarks,
        paymentDate: next.paymentDate,
        amountIssued: decimal(next.amountIssued),
        paymentType: next.paymentType,
        attendancePresentDays: line.attendancePresentDays,
      },
      include: { user: { select: lineUserSelect } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.line.updated',
      entityType: 'PayrollLine',
      entityId: id,
      previousValue: { id: line.id, netPay: line.netPay },
      newValue: { id: updated.id, netPay: updated.netPay },
    });

    return this.toLineResponse(updated);
  }

  async saveLines(
    runId: string,
    input: BulkSavePayrollLinesInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const run = await this.getRunOrThrow(runId, scope);
    if (isRunPaid(run)) {
      throw new BadRequestException('Paid salary sheets cannot be edited');
    }

    const ids = input.lines.map((line) => line.id);
    const existing = await this.prisma.payrollLine.findMany({
      where: { id: { in: ids }, runId },
    });
    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more lines do not belong to this salary sheet');
    }
    const byId = new Map(existing.map((line) => [line.id, line]));

    await this.prisma.$transaction(
      input.lines.map((patch) => {
        const line = byId.get(patch.id)!;
        const next = this.mergeLineInput(line, patch);
        return this.prisma.payrollLine.update({
          where: { id: patch.id },
          data: {
            ...sheetData(next),
            designation: next.designation,
            accountNumber: next.accountNumber,
            remarks: next.remarks,
            paymentDate: next.paymentDate,
            amountIssued: decimal(next.amountIssued),
            paymentType: next.paymentType,
            attendancePresentDays: line.attendancePresentDays,
          },
        });
      }),
    );

    await this.audit.log({
      userId: user.id,
      action: 'payroll.sheet.saved',
      entityType: 'PayrollRun',
      entityId: runId,
      newValue: { lineCount: input.lines.length },
    });

    return this.findRun(runId, scope);
  }

  async submitApproval(id: string, _user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (isRunPaid(run)) {
      throw new BadRequestException('This salary sheet is already paid');
    }
    return this.toRunSummary(run);
  }

  async sendBackToDraft(id: string, _user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (isRunPaid(run)) {
      throw new BadRequestException('Paid salary sheets cannot be reopened from send-back');
    }
    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'open', approvedById: null },
    });
    return this.toRunSummary(updated);
  }

  async approveRun(id: string, user: AuthUser, scope: BranchScope) {
    return this.markPaid(id, { paymentMethod: 'bank' }, user, scope);
  }

  async finalizeRun(id: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (isRunPaid(run)) return this.toRunSummary(run);
    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: { finalizedAt: new Date(), status: run.status === 'draft' ? 'open' : run.status },
    });
    return this.toRunSummary(updated);
  }

  async markPaid(id: string, input: MarkPayrollPaidInput, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(id, scope);
    if (isRunPaid(run)) {
      throw new BadRequestException('This salary sheet is already marked as paid');
    }

    const lines = await this.prisma.payrollLine.findMany({ where: { runId: id } });
    if (lines.length === 0) {
      throw new BadRequestException('Open the month and add staff before marking paid');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: input.paymentMethod,
        finalizedAt: run.finalizedAt ?? new Date(),
      },
      include: { lines: true },
    });

    const totalNet = updated.lines.reduce((sum, line) => sum + Number(line.netPay), 0);
    if (totalNet > 0) {
      await this.accountingPosting.postPayrollRun(id, updated.branchId, totalNet, user.id);
    }

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
    const rows = run.lines.map((line, index) => ({
      sr: index + 1,
      staffGroup: line.staffGroup,
      fullName: line.user?.fullName ?? '',
      accountNumber: line.accountNumber ?? '',
      designation: line.designation ?? '',
      basicSalary: line.basicSalary,
      perDay: line.workingDays ? Number((line.basicSalary / line.workingDays).toFixed(2)) : 0,
      workingDays: line.workingDays,
      absents: line.absents,
      deductedDays: line.deductedDays,
      extraLectures: line.extraLectures,
      extraLecAmount: line.extraLecAmount,
      lectureCount: line.lectureCount,
      ratePerClass: line.ratePerClass,
      lecturesAmount: line.lecturesAmount,
      otherAllowance: line.otherAllowance,
      entitlements: line.allowancesTotal,
      absentFine: line.absentFine,
      advanceDeduction: line.advanceDeduction,
      securityDeduct: line.securityDeduct,
      eobi: line.eobi,
      pessi: line.pessi,
      netPay: line.netPay,
      previousAdvance: line.previousAdvance,
      currentAdvance: line.currentAdvance,
      pendingAdvance: line.pendingAdvance,
      securityPrevious: line.securityPrevious,
      securityTillDate: line.securityTillDate,
      paymentDate: line.paymentDate,
      amountIssued: line.amountIssued,
      paymentType: line.paymentType ?? '',
      remarks: line.remarks ?? '',
    }));

    if (query.format === 'json') {
      return { data: rows, run: { year: run.year, month: run.month, status: run.status } };
    }

    const headers = [
      'Group',
      'Sr',
      'Name',
      'Account Number',
      'Designation',
      'Basic Pay',
      'Per Day',
      'Working Days',
      'Absents',
      'Deducted Days',
      'Extra Lectures',
      'Extra Lec Amount',
      'Lectures',
      'Rate Per Class',
      'Lectures Amount',
      'Other Allowance',
      'Entitlements',
      'Absent Fine',
      'Advance Deduction',
      'Security Deduct',
      'EOBI',
      'PESSI',
      'Net Pay',
      'Previous Advance',
      'Current Advance',
      'Pending Advance',
      'Security Previous',
      'Security Till Date',
      'Payment Date',
      'Amount Issued',
      'Payment Type',
      'Remarks',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          this.csvEscape(r.staffGroup),
          r.sr,
          this.csvEscape(r.fullName),
          this.csvEscape(r.accountNumber),
          this.csvEscape(r.designation),
          r.basicSalary,
          r.perDay,
          r.workingDays,
          r.absents,
          r.deductedDays,
          r.extraLectures,
          r.extraLecAmount,
          r.lectureCount,
          r.ratePerClass,
          r.lecturesAmount,
          r.otherAllowance,
          r.entitlements,
          r.absentFine,
          r.advanceDeduction,
          r.securityDeduct,
          r.eobi,
          r.pessi,
          r.netPay,
          r.previousAdvance,
          r.currentAdvance,
          r.pendingAdvance,
          r.securityPrevious,
          r.securityTillDate,
          this.csvEscape(r.paymentDate ?? ''),
          r.amountIssued,
          this.csvEscape(r.paymentType),
          this.csvEscape(r.remarks),
        ].join(','),
      ),
    ];
    return { csv: csvLines.join('\n'), filename: `salary-sheet-${run.year}-${String(run.month).padStart(2, '0')}.csv` };
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
    const computed = computeSalarySheetLine(this.mergeLineInput(line, {}));

    return {
      line: this.toLineResponse(line),
      run: {
        year: line.run.year,
        month: line.run.month,
        status: displayRunStatus(line.run),
        paidAt: line.run.paidAt?.toISOString() ?? null,
        paymentMethod: line.run.paymentMethod,
      },
      employee: {
        ...line.user,
        designation: line.designation ?? line.user.designation,
        staffCode: formatStaffCode(line.user.id),
      },
      institution: institution ?? { name: 'Institution', logoUrl: null, address: null },
      sheet: computed,
      printLayout: await this.resolvePrintLayout(line.run.branchId),
    };
  }

  async getRunPrintData(id: string, scope: BranchScope) {
    const detail = await this.findRun(id, scope);
    const institution = await this.prisma.institutionSettings.findFirst({
      select: { name: true, logoUrl: true, address: true },
    });
    return {
      run: detail,
      institution: institution ?? { name: 'Institution', logoUrl: null, address: null },
    };
  }

  private async fillMissingLines(runId: string, user: AuthUser, scope: BranchScope) {
    const run = await this.getRunOrThrow(runId, scope);
    const { from, to } = monthRange(run.year, run.month);
    const prior = previousPeriod(run.year, run.month);

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
      include: {
        user: { select: { id: true, fullName: true, designation: true } },
      },
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

    const existingLines = await this.prisma.payrollLine.findMany({
      where: { runId },
      select: { userId: true },
    });
    const existingUsers = new Set(existingLines.map((line) => line.userId));
    const missing = uniqueStructures.filter((s) => !existingUsers.has(s.userId));
    if (missing.length === 0) return;

    const priorRun = await this.prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId: run.branchId, year: prior.year, month: prior.month },
      },
      include: {
        lines: {
          where: { userId: { in: missing.map((s) => s.userId) } },
          select: { userId: true, pendingAdvance: true, securityTillDate: true },
        },
      },
    });
    const priorByUser = new Map(
      (priorRun?.lines ?? []).map((line) => [
        line.userId,
        {
          previousAdvance: toNumber(line.pendingAdvance),
          securityPrevious: toNumber(line.securityTillDate),
        },
      ]),
    );

    const missingIds = missing.map((s) => s.userId);
    const attendanceRecords = missingIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            branchId: run.branchId,
            entityId: { in: missingIds },
            entityType: { in: [...STAFF_ENTITY_TYPES] },
            date: { gte: from, lte: to },
          },
          select: { entityId: true, statusId: true },
        })
      : [];

    const absentsByUser = new Map<string, number>();
    const presentByUser = new Map<string, number>();
    for (const record of attendanceRecords) {
      if (absentId && record.statusId === absentId) {
        absentsByUser.set(record.entityId, (absentsByUser.get(record.entityId) ?? 0) + 1);
      }
      if (presentId && record.statusId === presentId) {
        presentByUser.set(record.entityId, (presentByUser.get(record.entityId) ?? 0) + 1);
      }
    }

    await this.prisma.payrollLine.createMany({
      skipDuplicates: true,
      data: missing.map((structure) => {
        const staffGroup = asStaffGroup(structure.staffGroup);
        const absents = absentsByUser.get(structure.userId) ?? 0;
        const carry = priorByUser.get(structure.userId);
        const input: SheetLineInput = {
          staffGroup,
          basicSalary: toNumber(structure.basicSalary),
          absents,
          extraLectures: 0,
          extraLecRate: toNumber(structure.extraLecRate) || DEFAULT_EXTRA_LEC_RATE,
          lectureCount: 0,
          ratePerClass: toNumber(structure.ratePerClass),
          otherAllowance: 0,
          advanceDeduction: 0,
          securityDeduct: 0,
          eobi: toNumber(structure.eobi),
          pessi: toNumber(structure.pessi),
          previousAdvance: carry?.previousAdvance ?? 0,
          currentAdvance: 0,
          securityPrevious: carry?.securityPrevious ?? 0,
        };
        const data = sheetData(input);
        return {
          runId,
          userId: structure.userId,
          designation: structure.user.designation ?? null,
          accountNumber: structure.bankAccount ?? null,
          attendancePresentDays: presentByUser.get(structure.userId) ?? 0,
          remarks: null,
          paymentDate: null,
          amountIssued: decimal(0),
          paymentType: null,
          ...data,
        };
      }),
    });

    await this.audit.log({
      userId: user.id,
      action: 'payroll.sheet.lines_added',
      entityType: 'PayrollRun',
      entityId: runId,
      newValue: { added: missing.length },
    });
  }

  private mergeLineInput(
    line: {
      staffGroup: string;
      designation: string | null;
      accountNumber: string | null;
      basicSalary: Prisma.Decimal;
      absents: number;
      extraLectures: number;
      extraLecRate: Prisma.Decimal;
      lectureCount: number;
      ratePerClass: Prisma.Decimal;
      otherAllowance: Prisma.Decimal;
      advanceDeduction: Prisma.Decimal;
      securityDeduct: Prisma.Decimal;
      eobi: Prisma.Decimal;
      pessi: Prisma.Decimal;
      previousAdvance: Prisma.Decimal;
      currentAdvance: Prisma.Decimal;
      securityPrevious: Prisma.Decimal;
      remarks: string | null;
      paymentDate: Date | null;
      amountIssued: Prisma.Decimal;
      paymentType: string | null;
    },
    input: UpdatePayrollLineInput,
  ) {
    return {
      staffGroup: input.staffGroup ?? asStaffGroup(line.staffGroup),
      designation: input.designation !== undefined ? input.designation : line.designation,
      accountNumber: input.accountNumber !== undefined ? input.accountNumber : line.accountNumber,
      basicSalary: input.basicSalary ?? toNumber(line.basicSalary),
      absents: input.absents ?? line.absents,
      extraLectures: input.extraLectures ?? line.extraLectures,
      extraLecRate: input.extraLecRate ?? toNumber(line.extraLecRate) ?? DEFAULT_EXTRA_LEC_RATE,
      lectureCount: input.lectureCount ?? line.lectureCount,
      ratePerClass: input.ratePerClass ?? toNumber(line.ratePerClass),
      otherAllowance: input.otherAllowance ?? toNumber(line.otherAllowance),
      advanceDeduction: input.advanceDeduction ?? toNumber(line.advanceDeduction),
      securityDeduct: input.securityDeduct ?? toNumber(line.securityDeduct),
      eobi: input.eobi ?? toNumber(line.eobi),
      pessi: input.pessi ?? toNumber(line.pessi),
      previousAdvance: input.previousAdvance ?? toNumber(line.previousAdvance),
      currentAdvance: input.currentAdvance ?? toNumber(line.currentAdvance),
      securityPrevious: input.securityPrevious ?? toNumber(line.securityPrevious),
      remarks: input.remarks !== undefined ? input.remarks : line.remarks,
      paymentDate:
        input.paymentDate !== undefined
          ? parseOptionalDate(input.paymentDate, 'paymentDate')
          : line.paymentDate,
      amountIssued: input.amountIssued ?? toNumber(line.amountIssued),
      paymentType: input.paymentType !== undefined ? input.paymentType : line.paymentType,
    };
  }

  private runStatusWhere(status?: string, excludeFinalized?: boolean): Prisma.PayrollRunWhereInput {
    if (status === 'paid' || status === 'finalized') {
      return { OR: [{ status: 'paid' }, { paidAt: { not: null } }] };
    }
    if (status === 'open' || status === 'draft' || status === 'pending_approval' || status === 'approved') {
      return { paidAt: null, status: { not: 'paid' } };
    }
    if (excludeFinalized) {
      return { paidAt: null, status: { not: 'paid' } };
    }
    return {};
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
    staffGroup: string;
    bankAccount: string | null;
    eobi: Prisma.Decimal;
    pessi: Prisma.Decimal;
    extraLecRate: Prisma.Decimal;
    ratePerClass: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; fullName: string; designation?: string | null };
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
      staffGroup: asStaffGroup(structure.staffGroup),
      bankAccount: structure.bankAccount,
      eobi: toNumber(structure.eobi),
      pessi: toNumber(structure.pessi),
      extraLecRate: toNumber(structure.extraLecRate),
      ratePerClass: toNumber(structure.ratePerClass),
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
      status: displayRunStatus(run),
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
    staffGroup: string;
    designation: string | null;
    accountNumber: string | null;
    basicSalary: Prisma.Decimal;
    allowancesTotal: Prisma.Decimal;
    deductionsTotal: Prisma.Decimal;
    adjustmentsTotal: Prisma.Decimal;
    netPay: Prisma.Decimal;
    attendancePresentDays: number;
    attendanceAbsentDays: number;
    workingDays: number;
    absents: number;
    deductedDays: number;
    extraLectures: number;
    lectureCount: number;
    ratePerClass: Prisma.Decimal;
    extraLecRate: Prisma.Decimal;
    extraLecAmount: Prisma.Decimal;
    lecturesAmount: Prisma.Decimal;
    otherAllowance: Prisma.Decimal;
    absentFine: Prisma.Decimal;
    advanceDeduction: Prisma.Decimal;
    securityDeduct: Prisma.Decimal;
    eobi: Prisma.Decimal;
    pessi: Prisma.Decimal;
    previousAdvance: Prisma.Decimal;
    currentAdvance: Prisma.Decimal;
    pendingAdvance: Prisma.Decimal;
    securityPrevious: Prisma.Decimal;
    securityTillDate: Prisma.Decimal;
    remarks: string | null;
    paymentDate: Date | null;
    amountIssued: Prisma.Decimal;
    paymentType: string | null;
    breakdown: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; fullName: string; designation?: string | null };
  }) {
    const computed = computeSalarySheetLine({
      staffGroup: asStaffGroup(line.staffGroup),
      basicSalary: toNumber(line.basicSalary),
      absents: line.absents,
      extraLectures: line.extraLectures,
      extraLecRate: toNumber(line.extraLecRate),
      lectureCount: line.lectureCount,
      ratePerClass: toNumber(line.ratePerClass),
      otherAllowance: toNumber(line.otherAllowance),
      advanceDeduction: toNumber(line.advanceDeduction),
      securityDeduct: toNumber(line.securityDeduct),
      eobi: toNumber(line.eobi),
      pessi: toNumber(line.pessi),
      previousAdvance: toNumber(line.previousAdvance),
      currentAdvance: toNumber(line.currentAdvance),
      securityPrevious: toNumber(line.securityPrevious),
    });
    return {
      id: line.id,
      runId: line.runId,
      userId: line.userId,
      staffGroup: asStaffGroup(line.staffGroup),
      designation: line.designation,
      accountNumber: line.accountNumber,
      basicSalary: toNumber(line.basicSalary),
      perDay: computed.perDay,
      allowancesTotal: toNumber(line.allowancesTotal),
      deductionsTotal: toNumber(line.deductionsTotal),
      adjustmentsTotal: toNumber(line.adjustmentsTotal),
      netPay: toNumber(line.netPay),
      attendancePresentDays: line.attendancePresentDays,
      attendanceAbsentDays: line.attendanceAbsentDays,
      workingDays: line.workingDays || PAYROLL_WORKING_DAYS,
      absents: line.absents,
      deductedDays: line.deductedDays,
      extraLectures: line.extraLectures,
      lectureCount: line.lectureCount,
      ratePerClass: toNumber(line.ratePerClass),
      extraLecRate: toNumber(line.extraLecRate),
      extraLecAmount: toNumber(line.extraLecAmount),
      lecturesAmount: toNumber(line.lecturesAmount),
      otherAllowance: toNumber(line.otherAllowance),
      entitlementsTotal: computed.entitlementsTotal,
      absentFine: toNumber(line.absentFine),
      advanceDeduction: toNumber(line.advanceDeduction),
      securityDeduct: toNumber(line.securityDeduct),
      eobi: toNumber(line.eobi),
      pessi: toNumber(line.pessi),
      previousAdvance: toNumber(line.previousAdvance),
      currentAdvance: toNumber(line.currentAdvance),
      pendingAdvance: toNumber(line.pendingAdvance),
      securityPrevious: toNumber(line.securityPrevious),
      securityTillDate: toNumber(line.securityTillDate),
      remarks: line.remarks,
      paymentDate: line.paymentDate ? line.paymentDate.toISOString().slice(0, 10) : null,
      amountIssued: toNumber(line.amountIssued),
      paymentType: line.paymentType,
      breakdown: line.breakdown,
      user: line.user ? { ...line.user, staffCode: formatStaffCode(line.user.id) } : undefined,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    };
  }

  private toRunDetail(
    run: {
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
        staffGroup: string;
        designation: string | null;
        accountNumber: string | null;
        basicSalary: Prisma.Decimal;
        allowancesTotal: Prisma.Decimal;
        deductionsTotal: Prisma.Decimal;
        adjustmentsTotal: Prisma.Decimal;
        netPay: Prisma.Decimal;
        attendancePresentDays: number;
        attendanceAbsentDays: number;
        workingDays: number;
        absents: number;
        deductedDays: number;
        extraLectures: number;
        lectureCount: number;
        ratePerClass: Prisma.Decimal;
        extraLecRate: Prisma.Decimal;
        extraLecAmount: Prisma.Decimal;
        lecturesAmount: Prisma.Decimal;
        otherAllowance: Prisma.Decimal;
        absentFine: Prisma.Decimal;
        advanceDeduction: Prisma.Decimal;
        securityDeduct: Prisma.Decimal;
        eobi: Prisma.Decimal;
        pessi: Prisma.Decimal;
        previousAdvance: Prisma.Decimal;
        currentAdvance: Prisma.Decimal;
        pendingAdvance: Prisma.Decimal;
        securityPrevious: Prisma.Decimal;
        securityTillDate: Prisma.Decimal;
        remarks: string | null;
        paymentDate: Date | null;
        amountIssued: Prisma.Decimal;
        paymentType: string | null;
        breakdown: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
        user: { id: string; fullName: string; designation?: string | null };
      }>;
    },
    branch?: { id: string; name: string } | null,
  ) {
    const lines = run.lines.map((line) => this.toLineResponse(line));
    const groupTotals = (group: StaffGroup) => {
      const groupLines = lines.filter((line) => line.staffGroup === group);
      return {
        count: groupLines.length,
        basicSalary: groupLines.reduce((sum, line) => sum + line.basicSalary, 0),
        entitlementsTotal: groupLines.reduce((sum, line) => sum + line.entitlementsTotal, 0),
        deductionsTotal: groupLines.reduce((sum, line) => sum + line.deductionsTotal, 0),
        netPay: groupLines.reduce((sum, line) => sum + line.netPay, 0),
      };
    };
    return {
      ...this.toRunSummary({ ...run, _count: { lines: lines.length } }),
      branch: branch ?? null,
      lines,
      totals: {
        permanent: groupTotals('permanent'),
        admin: groupTotals('admin'),
        visiting: groupTotals('visiting'),
        grand: {
          count: lines.length,
          basicSalary: lines.reduce((sum, line) => sum + line.basicSalary, 0),
          entitlementsTotal: lines.reduce((sum, line) => sum + line.entitlementsTotal, 0),
          deductionsTotal: lines.reduce((sum, line) => sum + line.deductionsTotal, 0),
          netPay: lines.reduce((sum, line) => sum + line.netPay, 0),
        },
      },
    };
  }
}
