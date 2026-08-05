import { prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { branchIdsFromScope, getSingleBranchId, selectedBranchScope } from '@eims/shared';
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
import { AccountingPostingService } from './accounting-posting.service';
import type { AuthUser } from '@eims/types';
import type {
  AccountStatementQuery,
  BudgetVsActualQuery,
  CreateAccountInput,
  CreateBudgetInput,
  CreateVoucherInput,
  IncomeExpenseQuery,
  ListAccountsQuery,
  ListBudgetsQuery,
  ListVouchersQuery,
  TrialBalanceQuery,
  UpdateAccountInput,
  UpdateBudgetInput,
  UpdateVoucherInput,
} from '@eims/shared';

const voucherInclude = {
  feeType: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { id: 'asc' as const },
  },
} as const;

const budgetInclude = {
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
  },
} as const;

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly posting: AccountingPostingService,
  ) {}

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return date;
  }

  private dateRange(from?: string, to?: string) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = this.parseDate(from, 'from date');
    if (to) {
      const end = this.parseDate(to, 'to date');
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private validateLinesBalance(
    lines: Array<{ debit: number; credit: number }>,
  ) {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException('Voucher debits and credits must balance');
    }
    if (totalDebit <= 0) {
      throw new BadRequestException('Voucher total must be greater than zero');
    }
    for (const line of lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException('Each line must be either debit or credit, not both');
      }
      if (line.debit <= 0 && line.credit <= 0) {
        throw new BadRequestException('Each line must have a debit or credit amount');
      }
    }
  }

  private async nextManualVoucherNo(branchId: string, voucherType: string) {
    const year = new Date().getFullYear();
    const prefix =
      voucherType === 'receipt' ? 'RCP' : voucherType === 'payment' ? 'PAY' : 'JNL';
    const pattern = `${prefix}-${year}-`;
    const last = await this.prisma.journalVoucher.findFirst({
      where: { branchId, voucherNo: { startsWith: pattern } },
      orderBy: { voucherNo: 'desc' },
    });
    let seq = 1;
    if (last) {
      const parts = last.voucherNo.split('-');
      const parsed = Number.parseInt(parts[parts.length - 1] ?? '', 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
    return `${pattern}${String(seq).padStart(4, '0')}`;
  }

  private toAccountResponse(account: {
    id: string;
    branchId: string | null;
    code: string;
    name: string;
    type: string;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: account.id,
      branchId: account.branchId,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem,
      isActive: account.isActive,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private toVoucherResponse(voucher: {
    id: string;
    branchId: string;
    voucherType: string;
    voucherNo: string;
    voucherDate: Date;
    narration: string | null;
    status: string;
    sourceType: string | null;
    sourceId: string | null;
    feeTypeId: string | null;
    postedAt: Date | null;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    feeType: { id: string; code: string; name: string } | null;
    lines: Array<{
      id: string;
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      memo: string | null;
      account: { id: string; code: string; name: string; type: string };
    }>;
  }) {
    return {
      id: voucher.id,
      branchId: voucher.branchId,
      voucherType: voucher.voucherType,
      voucherNo: voucher.voucherNo,
      voucherDate: voucher.voucherDate.toISOString().slice(0, 10),
      narration: voucher.narration,
      status: voucher.status,
      sourceType: voucher.sourceType,
      sourceId: voucher.sourceId,
      feeTypeId: voucher.feeTypeId,
      feeType: voucher.feeType,
      postedAt: voucher.postedAt?.toISOString() ?? null,
      createdById: voucher.createdById,
      createdAt: voucher.createdAt.toISOString(),
      updatedAt: voucher.updatedAt.toISOString(),
      lines: voucher.lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        debit: Number(line.debit),
        credit: Number(line.credit),
        memo: line.memo,
        account: line.account,
      })),
    };
  }

  async findAllAccounts(query: ListAccountsQuery, scope: BranchScope) {
    await this.posting.ensureDefaultChart();
    const scopedBranchIds =
      branchIdsFromScope(scope) ?? (query.branchId ? [query.branchId] : null);

    const where = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.activeOnly ? { isActive: true } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' as const } },
              { name: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(scopedBranchIds
        ? { OR: [{ branchId: null }, { branchId: { in: scopedBranchIds } }] }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.account.count({ where }),
    ]);

    return paginatedResult(
      accounts.map((account) => this.toAccountResponse(account)),
      total,
      page,
      limit,
    );
  }

  async createAccount(input: CreateAccountInput, user: AuthUser, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? input.branchId ?? null;
    if (effectiveBranchId === null && !user.permissions.includes('settings.manage')) {
      throw new BadRequestException('Branch is required for account creation');
    }

    const account = await this.prisma.account.create({
      data: {
        branchId: effectiveBranchId,
        code: input.code,
        name: input.name,
        type: input.type,
        isActive: input.isActive ?? true,
        isSystem: false,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.account.create',
      entityType: 'Account',
      entityId: account.id,
      newValue: account,
    });

    return this.toAccountResponse(account);
  }

  async updateAccount(
    id: string,
    input: UpdateAccountInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(scope.kind === 'selected'
          ? { OR: [{ branchId: null }, prismaBranchFilter(scope)] }
          : {}),
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.isSystem && (input.code !== undefined || input.type !== undefined)) {
      throw new BadRequestException('System accounts cannot change code or type');
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.account.update',
      entityType: 'Account',
      entityId: id,
      previousValue: account,
      newValue: updated,
    });

    return this.toAccountResponse(updated);
  }

  async removeAccount(id: string, user: AuthUser, scope: BranchScope) {
    const account = await this.prisma.account.findFirst({
      where: {
        id,
        deletedAt: null,
        ...prismaBranchFilter(scope),
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.isSystem) {
      throw new BadRequestException('System accounts cannot be deleted');
    }

    const lineCount = await this.prisma.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      throw new BadRequestException('Account has journal entries and cannot be deleted');
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.account.delete',
      entityType: 'Account',
      entityId: id,
      previousValue: account,
      newValue: updated,
    });

    return { success: true };
  }

  async findAllVouchers(query: ListVouchersQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const dateFilter = this.dateRange(query.from, query.to);

    const where = {
      ...prismaBranchFilter(effective),
      ...(query.status ? { status: query.status } : {}),
      ...(query.voucherType ? { voucherType: query.voucherType } : {}),
      ...(dateFilter ? { voucherDate: dateFilter } : {}),
      ...(query.search
        ? {
            OR: [
              { voucherNo: { contains: query.search, mode: 'insensitive' as const } },
              { narration: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [vouchers, total] = await Promise.all([
      this.prisma.journalVoucher.findMany({
        where,
        orderBy: [{ voucherDate: 'desc' }, { voucherNo: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: voucherInclude,
      }),
      this.prisma.journalVoucher.count({ where }),
    ]);

    return paginatedResult(
      vouchers.map((voucher) => this.toVoucherResponse(voucher)),
      total,
      page,
      limit,
    );
  }

  async findVoucher(id: string, scope: BranchScope) {
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: voucherInclude,
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    return this.toVoucherResponse(voucher);
  }

  async getVoucherPrintData(id: string, scope: BranchScope) {
    const voucher = await this.findVoucher(id, scope);
    const [settings, template] = await Promise.all([
      this.prisma.institutionSettings.findFirst(),
      this.prisma.printDocumentTemplate.findFirst({
        where: {
          type: 'accounting_voucher',
          isActive: true,
          OR: [{ branchId: voucher.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
    ]);
    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS.accounting_voucher;
    const stored =
      template?.fields && typeof template.fields === 'object' && !Array.isArray(template.fields)
        ? (template.fields as Record<string, boolean>)
        : {};
    return {
      voucher,
      institution: {
        name: settings?.name ?? 'Institution',
        logoUrl: settings?.logoUrl ?? null,
        address: settings?.address ?? null,
      },
      template: {
        paperSize: template?.paperSize ?? 'a4',
        fields: { ...defaults, ...stored },
        headerText: template?.headerText ?? null,
        footerText: template?.footerText ?? null,
        name: template?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES.accounting_voucher,
      },
    };
  }

  async createVoucher(input: CreateVoucherInput, user: AuthUser, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? input.branchId;
    this.validateLinesBalance(input.lines);

    const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: accountIds },
        deletedAt: null,
        isActive: true,
        OR: [{ branchId: null }, { branchId: effectiveBranchId }],
      },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more accounts are invalid for this branch');
    }

    const voucherNo = await this.nextManualVoucherNo(effectiveBranchId, input.voucherType);

    const voucher = await this.prisma.journalVoucher.create({
      data: {
        branchId: effectiveBranchId,
        voucherType: input.voucherType,
        voucherNo,
        voucherDate: this.parseDate(input.voucherDate, 'voucher date'),
        narration: input.narration,
        status: 'draft',
        sourceType: 'manual',
        createdById: user.id,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          })),
        },
      },
      include: voucherInclude,
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.voucher.create',
      entityType: 'JournalVoucher',
      entityId: voucher.id,
      newValue: voucher,
    });

    return this.toVoucherResponse(voucher);
  }

  async updateVoucher(
    id: string,
    input: UpdateVoucherInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { lines: true },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== 'draft') {
      throw new BadRequestException('Only draft vouchers can be edited');
    }
    if (voucher.sourceType && voucher.sourceType !== 'manual') {
      throw new BadRequestException('System-generated vouchers cannot be edited');
    }

    if (input.lines) {
      this.validateLinesBalance(input.lines);
      const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
      const accounts = await this.prisma.account.findMany({
        where: {
          id: { in: accountIds },
          deletedAt: null,
          isActive: true,
          OR: [{ branchId: null }, { branchId: voucher.branchId }],
        },
      });
      if (accounts.length !== accountIds.length) {
        throw new BadRequestException('One or more accounts are invalid for this branch');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.lines) {
        await tx.journalLine.deleteMany({ where: { voucherId: id } });
      }
      return tx.journalVoucher.update({
        where: { id },
        data: {
          ...(input.voucherType !== undefined ? { voucherType: input.voucherType } : {}),
          ...(input.voucherDate !== undefined
            ? { voucherDate: this.parseDate(input.voucherDate, 'voucher date') }
            : {}),
          ...(input.narration !== undefined ? { narration: input.narration } : {}),
          ...(input.lines
            ? {
                lines: {
                  create: input.lines.map((line) => ({
                    accountId: line.accountId,
                    debit: line.debit,
                    credit: line.credit,
                    memo: line.memo,
                  })),
                },
              }
            : {}),
            },
        include: voucherInclude,
      });
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.voucher.update',
      entityType: 'JournalVoucher',
      entityId: id,
      previousValue: voucher,
      newValue: updated,
    });

    return this.toVoucherResponse(updated);
  }

  async removeVoucher(id: string, user: AuthUser, scope: BranchScope) {
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== 'draft') {
      throw new BadRequestException('Only draft vouchers can be deleted');
    }
    if (voucher.sourceType && voucher.sourceType !== 'manual') {
      throw new BadRequestException('System-generated vouchers cannot be deleted');
    }

    await this.prisma.journalVoucher.delete({ where: { id } });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.voucher.delete',
      entityType: 'JournalVoucher',
      entityId: id,
      previousValue: voucher,
    });

    return { success: true };
  }

  async postVoucher(id: string, user: AuthUser, scope: BranchScope) {
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
      include: { lines: true },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status === 'posted') return this.findVoucher(id, scope);
    if (voucher.status !== 'draft') {
      throw new BadRequestException('Only draft vouchers can be posted');
    }

    this.validateLinesBalance(
      voucher.lines.map((line) => ({
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    );

    const updated = await this.prisma.journalVoucher.update({
      where: { id },
      data: { status: 'posted', postedAt: new Date() },
      include: voucherInclude,
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.voucher.post',
      entityType: 'JournalVoucher',
      entityId: id,
      previousValue: voucher,
      newValue: updated,
    });

    return this.toVoucherResponse(updated);
  }

  async unpostVoucher(id: string, user: AuthUser, scope: BranchScope) {
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== 'posted') {
      throw new BadRequestException('Only posted vouchers can be unposted');
    }
    if (voucher.sourceType && voucher.sourceType !== 'manual') {
      throw new BadRequestException('Only manual vouchers can be unposted');
    }

    const updated = await this.prisma.journalVoucher.update({
      where: { id },
      data: { status: 'draft', postedAt: null },
      include: voucherInclude,
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.voucher.unpost',
      entityType: 'JournalVoucher',
      entityId: id,
      previousValue: voucher,
      newValue: updated,
    });

    return this.toVoucherResponse(updated);
  }

  async findAllBudgets(query: ListBudgetsQuery, scope: BranchScope) {
    const scopedBranchIds =
      branchIdsFromScope(scope) ?? (query.branchId ? [query.branchId] : null);
    const where = {
      ...(scopedBranchIds
        ? { OR: [{ branchId: null }, { branchId: { in: scopedBranchIds } }] }
        : {}),
      ...(query.year ? { year: query.year } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [budgets, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: budgetInclude,
      }),
      this.prisma.budget.count({ where }),
    ]);

    return paginatedResult(
      budgets.map((budget) => ({
        id: budget.id,
        branchId: budget.branchId,
        year: budget.year,
        name: budget.name,
        createdAt: budget.createdAt.toISOString(),
        updatedAt: budget.updatedAt.toISOString(),
        lines: budget.lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          amount: Number(line.amount),
          account: line.account,
        })),
      })),
      total,
      page,
      limit,
    );
  }

  async createBudget(input: CreateBudgetInput, user: AuthUser, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? input.branchId ?? null;

    const budget = await this.prisma.budget.create({
      data: {
        branchId: effectiveBranchId,
        year: input.year,
        name: input.name,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            amount: line.amount,
          })),
        },
      },
      include: budgetInclude,
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.budget.create',
      entityType: 'Budget',
      entityId: budget.id,
      newValue: budget,
    });

    return {
      id: budget.id,
      branchId: budget.branchId,
      year: budget.year,
      name: budget.name,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
      lines: budget.lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        amount: Number(line.amount),
        account: line.account,
      })),
    };
  }

  async updateBudget(
    id: string,
    input: UpdateBudgetInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: {
        id,
        ...(scope.kind === 'selected'
          ? { OR: [{ branchId: null }, prismaBranchFilter(scope)] }
          : {}),
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.lines) {
        await tx.budgetLine.deleteMany({ where: { budgetId: id } });
      }
      return tx.budget.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.year !== undefined ? { year: input.year } : {}),
          ...(input.lines
            ? {
                lines: {
                  create: input.lines.map((line) => ({
                    accountId: line.accountId,
                    amount: line.amount,
                  })),
                },
              }
            : {}),
        },
        include: budgetInclude,
      });
    });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.budget.update',
      entityType: 'Budget',
      entityId: id,
      previousValue: budget,
      newValue: updated,
    });

    return {
      id: updated.id,
      branchId: updated.branchId,
      year: updated.year,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      lines: updated.lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        amount: Number(line.amount),
        account: line.account,
      })),
    };
  }

  async removeBudget(id: string, user: AuthUser, scope: BranchScope) {
    const budget = await this.prisma.budget.findFirst({
      where: {
        id,
        ...(scope.kind === 'selected'
          ? { OR: [{ branchId: null }, prismaBranchFilter(scope)] }
          : {}),
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    await this.prisma.budget.delete({ where: { id } });

    await this.audit.log({
      userId: user.id,
      action: 'accounting.budget.delete',
      entityType: 'Budget',
      entityId: id,
      previousValue: budget,
    });

    return { success: true };
  }

  private async postedLinesForBranch(
    branchId: string,
    from?: string,
    to?: string,
  ) {
    const dateFilter = this.dateRange(from, to);
    return this.prisma.journalLine.findMany({
      where: {
        voucher: {
          status: 'posted',
          branchId,
          ...(dateFilter ? { voucherDate: dateFilter } : {}),
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        voucher: { select: { id: true, voucherNo: true, voucherDate: true, narration: true } },
      },
      orderBy: [{ voucher: { voucherDate: 'asc' } }, { id: 'asc' }],
    });
  }

  async trialBalance(query: TrialBalanceQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branch is required for trial balance');
    }

    await this.posting.ensureDefaultChart();
    const lines = await this.postedLinesForBranch(effectiveBranchId, query.from, query.to);

    const byAccount = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        type: string;
        debit: number;
        credit: number;
      }
    >();

    for (const line of lines) {
      const current = byAccount.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      byAccount.set(line.accountId, current);
    }

    const rows = [...byAccount.values()]
      .map((row) => ({
        ...row,
        balance: row.debit - row.credit,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totals = rows.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
      }),
      { debit: 0, credit: 0 },
    );

    return {
      branchId: effectiveBranchId,
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: {
        ...totals,
        balanced: Math.abs(totals.debit - totals.credit) < 0.001,
      },
    };
  }

  async incomeExpense(query: IncomeExpenseQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branch is required for income & expense report');
    }

    const lines = await this.postedLinesForBranch(effectiveBranchId, query.from, query.to);
    const income = new Map<string, { accountId: string; code: string; name: string; amount: number }>();
    const expense = new Map<string, { accountId: string; code: string; name: string; amount: number }>();

    for (const line of lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (line.account.type === 'income') {
        const current = income.get(line.accountId) ?? {
          accountId: line.accountId,
          code: line.account.code,
          name: line.account.name,
          amount: 0,
        };
        current.amount += credit - debit;
        income.set(line.accountId, current);
      } else if (line.account.type === 'expense') {
        const current = expense.get(line.accountId) ?? {
          accountId: line.accountId,
          code: line.account.code,
          name: line.account.name,
          amount: 0,
        };
        current.amount += debit - credit;
        expense.set(line.accountId, current);
      }
    }

    const incomeRows = [...income.values()].sort((a, b) => a.code.localeCompare(b.code));
    const expenseRows = [...expense.values()].sort((a, b) => a.code.localeCompare(b.code));
    const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expenseRows.reduce((sum, row) => sum + row.amount, 0);

    return {
      branchId: effectiveBranchId,
      from: query.from ?? null,
      to: query.to ?? null,
      income: incomeRows,
      expense: expenseRows,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense,
      },
    };
  }

  async accountStatement(query: AccountStatementQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branch is required for account statement');
    }

    const account = await this.prisma.account.findFirst({
      where: {
        id: query.accountId,
        deletedAt: null,
        OR: [{ branchId: null }, { branchId: effectiveBranchId }],
      },
    });
    if (!account) throw new NotFoundException('Account not found');

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: query.accountId,
        voucher: {
          status: 'posted',
          branchId: effectiveBranchId,
          ...(this.dateRange(query.from, query.to)
            ? { voucherDate: this.dateRange(query.from, query.to) }
            : {}),
        },
      },
      include: {
        voucher: { select: { voucherNo: true, voucherDate: true, narration: true } },
      },
      orderBy: [{ voucher: { voucherDate: 'asc' } }, { id: 'asc' }],
    });

    let running = 0;
    const entries = lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      running += debit - credit;
      return {
        voucherNo: line.voucher.voucherNo,
        voucherDate: line.voucher.voucherDate.toISOString().slice(0, 10),
        narration: line.voucher.narration,
        memo: line.memo,
        debit,
        credit,
        balance: running,
      };
    });

    return {
      branchId: effectiveBranchId,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      from: query.from ?? null,
      to: query.to ?? null,
      entries,
      closingBalance: running,
    };
  }

  async budgetVsActual(query: BudgetVsActualQuery, scope: BranchScope) {
    const effectiveBranchId = getSingleBranchId(scope) ?? query.branchId;
    if (!effectiveBranchId) {
      throw new BadRequestException('A single branch is required for budget vs actual report');
    }

    const budget = query.budgetId
      ? await this.prisma.budget.findFirst({
          where: {
            id: query.budgetId,
            OR: [{ branchId: null }, { branchId: effectiveBranchId }],
          },
          include: budgetInclude,
        })
      : await this.prisma.budget.findFirst({
          where: {
            year: query.year ?? new Date().getFullYear(),
            OR: [{ branchId: null }, { branchId: effectiveBranchId }],
          },
          orderBy: { createdAt: 'desc' },
          include: budgetInclude,
        });

    if (!budget) throw new NotFoundException('Budget not found');

    const yearStart = new Date(Date.UTC(budget.year, 0, 1));
    const yearEnd = new Date(Date.UTC(budget.year, 11, 31, 23, 59, 59, 999));

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: budget.lines.map((line) => line.accountId) },
        voucher: {
          status: 'posted',
          branchId: effectiveBranchId,
          voucherDate: { gte: yearStart, lte: yearEnd },
        },
      },
      include: { account: { select: { type: true } } },
    });

    const actualByAccount = new Map<string, number>();
    for (const line of lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const current = actualByAccount.get(line.accountId) ?? 0;
      if (line.account.type === 'income') {
        actualByAccount.set(line.accountId, current + (credit - debit));
      } else if (line.account.type === 'expense') {
        actualByAccount.set(line.accountId, current + (debit - credit));
      } else {
        actualByAccount.set(line.accountId, current + Math.abs(debit - credit));
      }
    }

    const rows = budget.lines.map((line) => {
      const budgetAmount = Number(line.amount);
      const actualAmount = actualByAccount.get(line.accountId) ?? 0;
      return {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        budget: budgetAmount,
        actual: actualAmount,
        variance: budgetAmount - actualAmount,
      };
    });

    return {
      branchId: effectiveBranchId,
      budget: {
        id: budget.id,
        name: budget.name,
        year: budget.year,
      },
      rows,
      totals: rows.reduce(
        (acc, row) => ({
          budget: acc.budget + row.budget,
          actual: acc.actual + row.actual,
          variance: acc.variance + row.variance,
        }),
        { budget: 0, actual: 0, variance: 0 },
      ),
    };
  }
}
