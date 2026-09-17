import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { getSingleBranchId, type BranchScope } from '@eims/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { paginatedResult } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService, DRAWINGS_ACCOUNT_CODE } from '../accounting/accounting-posting.service';
import { asNumber, containsSearch, parseYmd, toIso, toYmd } from '../../common/ops/date.util';
import type { AuthUser } from '@eims/types';
import type {
  CreateBankStatementInput,
  CreateBankStatementLineInput,
  CreateBudgetForecastLineInput,
  CreateFixedAssetInput,
  CreateOwnerDrawingInput,
  CreatePettyCashFundInput,
  CreatePettyCashVoucherInput,
  CreatePurchaseOrderInput,
  CreateVendorBillInput,
  CreateVendorInput,
  FinanceOpsReportQuery,
  ListBankStatementsQuery,
  ListBudgetForecastLinesQuery,
  ListFixedAssetsQuery,
  ListOwnerDrawingsQuery,
  ListPettyCashFundsQuery,
  ListPettyCashVouchersQuery,
  ListPurchaseOrdersQuery,
  ListVendorBillsQuery,
  ListVendorsQuery,
  MatchBankStatementLineInput,
  PayVendorBillInput,
  ReceivePurchaseOrderInput,
  UpdateBankStatementInput,
  UpdateBudgetForecastLineInput,
  UpdateFixedAssetInput,
  UpdatePettyCashFundInput,
  UpdatePurchaseOrderInput,
  UpdateVendorBillInput,
  UpdateVendorInput,
} from '@eims/shared';

const vendorSelect = { select: { id: true, name: true } } as const;
const namedSelect = { select: { id: true, name: true, code: true } } as const;

function expenseCodeForCategory(category: string): string {
  if (category === 'electricity') return '5210';
  if (category === 'gas') return '5220';
  if (category === 'water') return '5230';
  if (category === 'phone') return '5240';
  if (category === 'utility') return '5200';
  if (category === 'maintenance') return '5300';
  if (category === 'asset') return '1600';
  return '5100';
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

const statementLineInclude = { orderBy: [{ issueDate: 'asc' as const }, { chequeNumber: 'asc' as const }] };

function billStatus(amount: number, paidAmount: number, current?: string): string {
  if (current === 'void') return 'void';
  if (paidAmount <= 0) return 'open';
  if (paidAmount >= amount) return 'paid';
  return 'partial';
}

@Injectable()
export class FinanceOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly posting: AccountingPostingService,
  ) {}

  // --- Vendors ---

  async listVendors(query: ListVendorsQuery, scope: BranchScope) {
    const where: Prisma.VendorWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...containsSearch(query.search, ['name', 'phone', 'email']),
    };
    return this.page(this.prisma.vendor, where, { name: 'asc' }, query, (row) => this.toVendor(row));
  }

  async createVendor(input: CreateVendorInput, user: AuthUser) {
    const row = await this.prisma.vendor.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.vendor.created',
      entityType: 'Vendor',
      entityId: row.id,
      newValue: row,
    });
    return this.toVendor(row);
  }

  async updateVendor(id: string, input: UpdateVendorInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireVendor(id, scope);
    const row = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.vendor.updated',
      entityType: 'Vendor',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toVendor(row);
  }

  async removeVendor(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireVendor(id, scope);
    await this.prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.vendor.deleted',
      entityType: 'Vendor',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Vendor bills / AP ---

  async listBills(query: ListVendorBillsQuery, scope: BranchScope) {
    const where: Prisma.VendorBillWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['billNo', 'description']),
    };
    return this.page(
      this.prisma.vendorBill,
      where,
      { billDate: 'desc' },
      query,
      (row) => this.toBill(row),
      { vendor: vendorSelect, payments: true },
    );
  }

  async createBill(input: CreateVendorBillInput, user: AuthUser) {
    await this.requireVendor(input.vendorId, { kind: 'selected', branchIds: [input.branchId] });
    const row = await this.prisma.vendorBill.create({
      data: {
        branchId: input.branchId,
        vendorId: input.vendorId,
        billNo: input.billNo ?? null,
        billDate: parseYmd(input.billDate, 'billDate'),
        dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        status: 'open',
      },
      include: { vendor: vendorSelect, payments: true },
    });

    const voucher = await this.posting.postDoubleEntry({
      branchId: input.branchId,
      voucherType: 'journal',
      sourceType: 'vendor_bill',
      sourceId: row.id,
      narration: `Vendor bill ${row.billNo ?? row.id}`,
      debitAccountCode: expenseCodeForCategory(input.category),
      creditAccountCode: '2000',
      amount: input.amount,
      userId: user.id,
      voucherDate: parseYmd(input.billDate, 'billDate'),
    });

    const posted = await this.prisma.vendorBill.update({
      where: { id: row.id },
      data: { journalVoucherId: voucher.id },
      include: { vendor: vendorSelect, payments: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bill.created',
      entityType: 'VendorBill',
      entityId: row.id,
      newValue: posted,
    });
    return this.toBill(posted);
  }

  async updateBill(id: string, input: UpdateVendorBillInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireBill(id, scope);
    if (existing.status === 'paid' || existing.status === 'void') {
      throw new BadRequestException('Paid or void bills cannot be edited');
    }
    const row = await this.prisma.vendorBill.update({
      where: { id },
      data: {
        ...(input.billNo !== undefined ? { billNo: input.billNo } : {}),
        ...(input.billDate !== undefined ? { billDate: parseYmd(input.billDate, 'billDate') } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: { vendor: vendorSelect, payments: true },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bill.updated',
      entityType: 'VendorBill',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toBill(row);
  }

  async payBill(id: string, input: PayVendorBillInput, user: AuthUser, scope: BranchScope) {
    const bill = await this.requireBill(id, scope);
    if (bill.status === 'void' || bill.status === 'paid') {
      throw new BadRequestException('This bill cannot accept payment');
    }
    const remaining = asNumber(bill.amount) - asNumber(bill.paidAmount);
    if (input.amount > remaining + 0.001) {
      throw new BadRequestException('Payment exceeds remaining balance');
    }

    const payment = await this.prisma.vendorPayment.create({
      data: {
        billId: id,
        amount: input.amount,
        paidAt: parseYmd(input.paidAt, 'paidAt'),
        method: input.method ?? null,
        chequeNumber: input.chequeNumber?.trim() || null,
      },
    });

    const voucher = await this.posting.postDoubleEntry({
      branchId: bill.branchId,
      voucherType: 'payment',
      sourceType: 'vendor_payment',
      sourceId: payment.id,
      narration: `AP payment ${bill.billNo ?? bill.id}`,
      debitAccountCode: '2000',
      creditAccountCode: input.method === 'cheque' ? '1100' : '1000',
      amount: input.amount,
      userId: user.id,
      voucherDate: parseYmd(input.paidAt, 'paidAt'),
    });

    await this.prisma.vendorPayment.update({
      where: { id: payment.id },
      data: { journalVoucherId: voucher.id },
    });

    const paidAmount = asNumber(bill.paidAmount) + input.amount;
    const updated = await this.prisma.vendorBill.update({
      where: { id },
      data: {
        paidAmount,
        status: billStatus(asNumber(bill.amount), paidAmount),
      },
      include: { vendor: vendorSelect, payments: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bill.paid',
      entityType: 'VendorBill',
      entityId: id,
      newValue: updated,
    });
    return this.toBill(updated);
  }

  async removeBill(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireBill(id, scope);
    if (asNumber(existing.paidAmount) > 0) {
      throw new BadRequestException('Paid bills cannot be deleted');
    }
    await this.prisma.vendorBill.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'void' },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bill.deleted',
      entityType: 'VendorBill',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Petty cash ---

  async listFunds(query: ListPettyCashFundsQuery, scope: BranchScope) {
    const where: Prisma.PettyCashFundWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...containsSearch(query.search, ['name']),
    };
    return this.page(this.prisma.pettyCashFund, where, { name: 'asc' }, query, (row) => this.toFund(row));
  }

  async createFund(input: CreatePettyCashFundInput, user: AuthUser) {
    const row = await this.prisma.pettyCashFund.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        openingBalance: input.openingBalance ?? 0,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.petty_fund.created',
      entityType: 'PettyCashFund',
      entityId: row.id,
      newValue: row,
    });
    return this.toFund(row);
  }

  async updateFund(id: string, input: UpdatePettyCashFundInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireFund(id, scope);
    const row = await this.prisma.pettyCashFund.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.openingBalance !== undefined ? { openingBalance: input.openingBalance } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.petty_fund.updated',
      entityType: 'PettyCashFund',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toFund(row);
  }

  async removeFund(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireFund(id, scope);
    await this.prisma.pettyCashFund.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.petty_fund.deleted',
      entityType: 'PettyCashFund',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  async listPettyVouchers(query: ListPettyCashVouchersQuery, scope: BranchScope) {
    const where: Prisma.PettyCashVoucherWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.fundId ? { fundId: query.fundId } : {}),
      ...containsSearch(query.search, ['payee', 'description']),
    };
    return this.page(
      this.prisma.pettyCashVoucher,
      where,
      { voucherDate: 'desc' },
      query,
      (row) => this.toPettyVoucher(row),
      { fund: { select: { id: true, name: true } } },
    );
  }

  async createPettyVoucher(input: CreatePettyCashVoucherInput, user: AuthUser) {
    const fund = await this.requireFund(input.fundId, { kind: 'selected', branchIds: [input.branchId] });
    const row = await this.prisma.pettyCashVoucher.create({
      data: {
        fundId: fund.id,
        branchId: input.branchId,
        voucherDate: parseYmd(input.voucherDate, 'voucherDate'),
        amount: input.amount,
        payee: input.payee,
        description: input.description,
      },
      include: { fund: { select: { id: true, name: true } } },
    });

    const voucher = await this.posting.postDoubleEntry({
      branchId: input.branchId,
      voucherType: 'payment',
      sourceType: 'petty_cash',
      sourceId: row.id,
      narration: `Petty cash ${row.payee}`,
      debitAccountCode: '5100',
      creditAccountCode: '1000',
      amount: input.amount,
      userId: user.id,
      voucherDate: parseYmd(input.voucherDate, 'voucherDate'),
    });

    const posted = await this.prisma.pettyCashVoucher.update({
      where: { id: row.id },
      data: { journalVoucherId: voucher.id },
      include: { fund: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.petty_voucher.created',
      entityType: 'PettyCashVoucher',
      entityId: row.id,
      newValue: posted,
    });
    return this.toPettyVoucher(posted);
  }

  async removePettyVoucher(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.pettyCashVoucher.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Petty cash voucher not found');
    await this.prisma.pettyCashVoucher.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.petty_voucher.deleted',
      entityType: 'PettyCashVoucher',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Issued cheque register ---

  async listStatements(query: ListBankStatementsQuery, scope: BranchScope) {
    const where: Prisma.BankStatementWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.year ? { year: query.year } : {}),
      ...(query.month ? { month: query.month } : {}),
      ...containsSearch(query.search, ['bankName', 'chequeBookNo']),
    };
    return this.page(
      this.prisma.bankStatement,
      where,
      [{ year: 'desc' }, { month: 'desc' }] as object,
      query,
      (row) => this.toStatement(row),
      { account: namedSelect, lines: statementLineInclude },
    );
  }

  async getStatement(id: string, scope: BranchScope) {
    return this.toStatement(await this.requireStatement(id, scope));
  }

  async createStatement(input: CreateBankStatementInput, user: AuthUser) {
    try {
      const row = await this.prisma.bankStatement.create({
        data: {
          branchId: input.branchId,
          accountId: input.accountId ?? null,
          year: input.year,
          month: input.month,
          bankName: input.bankName,
          chequeBookNo: input.chequeBookNo?.trim() || '',
          chequeBookSerialFrom: input.chequeBookSerialFrom?.trim() || null,
          chequeBookSerialTo: input.chequeBookSerialTo?.trim() || null,
          status: input.status ?? 'open',
        },
        include: { account: namedSelect, lines: statementLineInclude },
      });
      await this.audit.log({
        userId: user.id,
        action: 'finance_ops.bank_statement.created',
        entityType: 'BankStatement',
        entityId: row.id,
        newValue: row,
      });
      return this.toStatement(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A cheque register already exists for this month and cheque book');
      }
      throw error;
    }
  }

  async updateStatement(id: string, input: UpdateBankStatementInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireStatement(id, scope);
    try {
      const row = await this.prisma.bankStatement.update({
        where: { id },
        data: {
          ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
          ...(input.year !== undefined ? { year: input.year } : {}),
          ...(input.month !== undefined ? { month: input.month } : {}),
          ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
          ...(input.chequeBookNo !== undefined ? { chequeBookNo: input.chequeBookNo?.trim() || '' } : {}),
          ...(input.chequeBookSerialFrom !== undefined
            ? { chequeBookSerialFrom: input.chequeBookSerialFrom?.trim() || null }
            : {}),
          ...(input.chequeBookSerialTo !== undefined
            ? { chequeBookSerialTo: input.chequeBookSerialTo?.trim() || null }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        include: { account: namedSelect, lines: statementLineInclude },
      });
      await this.audit.log({
        userId: user.id,
        action: 'finance_ops.bank_statement.updated',
        entityType: 'BankStatement',
        entityId: id,
        previousValue: existing,
        newValue: row,
      });
      return this.toStatement(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A cheque register already exists for this month and cheque book');
      }
      throw error;
    }
  }

  async addStatementLine(statementId: string, input: CreateBankStatementLineInput, user: AuthUser, scope: BranchScope) {
    const statement = await this.requireStatement(statementId, scope);
    const line = await this.prisma.bankStatementLine.create({
      data: {
        statementId: statement.id,
        issueDate: parseYmd(input.issueDate, 'issueDate'),
        chequeNumber: input.chequeNumber.trim(),
        payee: input.payee,
        onAccountOf: input.onAccountOf,
        amount: input.amount,
        useInCampus: input.useInCampus?.trim() || null,
        clearingDate: input.clearingDate ? parseYmd(input.clearingDate, 'clearingDate') : null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bank_line.created',
      entityType: 'BankStatementLine',
      entityId: line.id,
      newValue: line,
    });
    return this.toStatementLine(line);
  }

  async removeStatementLine(statementId: string, lineId: string, user: AuthUser, scope: BranchScope) {
    await this.requireStatement(statementId, scope);
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, statementId },
    });
    if (!line) throw new NotFoundException('Cheque line not found');
    await this.prisma.bankStatementLine.delete({ where: { id: lineId } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bank_line.deleted',
      entityType: 'BankStatementLine',
      entityId: lineId,
      previousValue: line,
    });
    return { success: true };
  }

  async matchStatementLine(
    lineId: string,
    input: MatchBankStatementLineInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, statement: { deletedAt: null, ...prismaBranchFilter(scope) } },
    });
    if (!line) throw new NotFoundException('Bank statement line not found');

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: input.clear
        ? { matchedJournalLineId: null, matchedFeePaymentId: null }
        : {
            matchedJournalLineId: input.journalLineId ?? null,
            matchedFeePaymentId: input.feePaymentId ?? null,
          },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bank_line.matched',
      entityType: 'BankStatementLine',
      entityId: lineId,
      newValue: updated,
    });
    return this.toStatementLine(updated);
  }

  async removeStatement(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireStatement(id, scope);
    await this.prisma.bankStatement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.bank_statement.deleted',
      entityType: 'BankStatement',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Owner drawings ---

  async listDrawings(query: ListOwnerDrawingsQuery, scope: BranchScope) {
    const where: Prisma.OwnerDrawingWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...containsSearch(query.search, ['payee', 'notes', 'chequeNumber']),
    };
    return this.page(
      this.prisma.ownerDrawing,
      where,
      { drawingDate: 'desc' },
      query,
      (row) => this.toDrawing(row),
    );
  }

  async createDrawing(input: CreateOwnerDrawingInput, user: AuthUser) {
    const row = await this.prisma.ownerDrawing.create({
      data: {
        branchId: input.branchId,
        drawingDate: parseYmd(input.drawingDate, 'drawingDate'),
        payee: input.payee,
        amount: input.amount,
        method: input.method,
        chequeNumber: input.chequeNumber?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    const voucher = await this.posting.postDoubleEntry({
      branchId: input.branchId,
      voucherType: 'payment',
      sourceType: 'owner_drawing',
      sourceId: row.id,
      narration: `Owner drawing — ${row.payee}`,
      debitAccountCode: DRAWINGS_ACCOUNT_CODE,
      creditAccountCode: input.method === 'cheque' ? '1100' : '1000',
      amount: input.amount,
      userId: user.id,
      voucherDate: parseYmd(input.drawingDate, 'drawingDate'),
    });

    const posted = await this.prisma.ownerDrawing.update({
      where: { id: row.id },
      data: { journalVoucherId: voucher.id },
    });

    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.drawing.created',
      entityType: 'OwnerDrawing',
      entityId: posted.id,
      newValue: posted,
    });
    return this.toDrawing(posted);
  }

  async removeDrawing(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.ownerDrawing.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Drawing not found');
    await this.prisma.ownerDrawing.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.drawing.deleted',
      entityType: 'OwnerDrawing',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Procurement ---

  async listPurchaseOrders(query: ListPurchaseOrdersQuery, scope: BranchScope) {
    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['poNo', 'notes']),
    };
    return this.page(
      this.prisma.purchaseOrder,
      where,
      { orderDate: 'desc' },
      query,
      (row) => this.toPo(row),
      { vendor: vendorSelect, lines: true, receipts: true },
    );
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput, user: AuthUser) {
    const row = await this.prisma.purchaseOrder.create({
      data: {
        branchId: input.branchId,
        vendorId: input.vendorId,
        poNo: input.poNo,
        orderDate: parseYmd(input.orderDate, 'orderDate'),
        status: input.status ?? 'draft',
        notes: input.notes ?? null,
        lines: {
          create: input.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        },
      },
      include: { vendor: vendorSelect, lines: true, receipts: true },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.po.created',
      entityType: 'PurchaseOrder',
      entityId: row.id,
      newValue: row,
    });
    return this.toPo(row);
  }

  async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requirePo(id, scope);
    if (existing.status === 'received') {
      throw new BadRequestException('Received purchase orders cannot be edited');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.lines) {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
          ...(input.poNo !== undefined ? { poNo: input.poNo } : {}),
          ...(input.orderDate !== undefined ? { orderDate: parseYmd(input.orderDate, 'orderDate') } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.lines
            ? {
                lines: {
                  create: input.lines.map((line) => ({
                    description: line.description,
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                  })),
                },
              }
            : {}),
        },
        include: { vendor: vendorSelect, lines: true, receipts: true },
      });
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.po.updated',
      entityType: 'PurchaseOrder',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toPo(row);
  }

  async receivePurchaseOrder(
    id: string,
    input: ReceivePurchaseOrderInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const po = await this.requirePo(id, scope);
    if (po.status === 'cancelled') throw new BadRequestException('Cancelled PO cannot be received');
    await this.prisma.goodsReceipt.create({
      data: {
        purchaseOrderId: id,
        receivedAt: parseYmd(input.receivedAt, 'receivedAt'),
        notes: input.notes ?? null,
      },
    });
    const row = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'received' },
      include: { vendor: vendorSelect, lines: true, receipts: true },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.po.received',
      entityType: 'PurchaseOrder',
      entityId: id,
      newValue: row,
    });
    return this.toPo(row);
  }

  async removePurchaseOrder(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requirePo(id, scope);
    await this.prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.po.deleted',
      entityType: 'PurchaseOrder',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Assets ---

  async listAssets(query: ListFixedAssetsQuery, scope: BranchScope) {
    const where: Prisma.FixedAssetWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...containsSearch(query.search, ['name', 'category', 'notes']),
    };
    return this.page(this.prisma.fixedAsset, where, { name: 'asc' }, query, (row) => this.toAsset(row), {
      batch: { select: { id: true, name: true } },
    });
  }

  async createAsset(input: CreateFixedAssetInput, user: AuthUser) {
    const row = await this.prisma.fixedAsset.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        category: input.category,
        scope: input.scope ?? 'school',
        quantity: input.quantity ?? 1,
        batchId: input.scope === 'class' ? (input.batchId ?? null) : null,
        purchaseDate: input.purchaseDate ? parseYmd(input.purchaseDate, 'purchaseDate') : null,
        cost: input.cost,
        vendorBillId: input.vendorBillId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        status: input.status ?? 'active',
        notes: input.notes ?? null,
      },
      include: { batch: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.asset.created',
      entityType: 'FixedAsset',
      entityId: row.id,
      newValue: row,
    });
    return this.toAsset(row);
  }

  async updateAsset(id: string, input: UpdateFixedAssetInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireAsset(id, scope);
    const nextScope = input.scope ?? existing.scope;
    const row = await this.prisma.fixedAsset.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.batchId !== undefined || input.scope !== undefined
          ? { batchId: nextScope === 'class' ? (input.batchId ?? existing.batchId) : null }
          : {}),
        ...(input.purchaseDate !== undefined
          ? { purchaseDate: input.purchaseDate ? parseYmd(input.purchaseDate, 'purchaseDate') : null }
          : {}),
        ...(input.cost !== undefined ? { cost: input.cost } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.vendorBillId !== undefined ? { vendorBillId: input.vendorBillId } : {}),
        ...(input.purchaseOrderId !== undefined ? { purchaseOrderId: input.purchaseOrderId } : {}),
      },
      include: { batch: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.asset.updated',
      entityType: 'FixedAsset',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toAsset(row);
  }

  async removeAsset(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireAsset(id, scope);
    await this.prisma.fixedAsset.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.asset.deleted',
      entityType: 'FixedAsset',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Forecast ---

  async listForecastLines(query: ListBudgetForecastLinesQuery, scope: BranchScope) {
    const budgetFilter = query.budgetId
      ? { id: query.budgetId }
      : scope.kind === 'all'
        ? {}
        : { OR: [{ branchId: null }, prismaBranchFilter(scope)] };
    const budgets = await this.prisma.budget.findMany({
      where: budgetFilter,
      select: { id: true },
    });
    const where: Prisma.BudgetForecastLineWhereInput = {
      budgetId: { in: budgets.map((b) => b.id) },
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.budgetForecastLine.findMany({
        where,
        orderBy: [{ budgetId: 'asc' }, { month: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { budget: { select: { id: true, name: true, year: true, branchId: true } } },
      }),
      this.prisma.budgetForecastLine.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toForecast(row)), total, page, limit);
  }

  async createForecastLine(input: CreateBudgetForecastLineInput, user: AuthUser) {
    const row = await this.prisma.budgetForecastLine.upsert({
      where: { budgetId_month: { budgetId: input.budgetId, month: input.month } },
      create: { budgetId: input.budgetId, month: input.month, amount: input.amount },
      update: { amount: input.amount },
      include: { budget: { select: { id: true, name: true, year: true, branchId: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.forecast.upserted',
      entityType: 'BudgetForecastLine',
      entityId: row.id,
      newValue: row,
    });
    return this.toForecast(row);
  }

  async updateForecastLine(id: string, input: UpdateBudgetForecastLineInput, user: AuthUser) {
    const existing = await this.prisma.budgetForecastLine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forecast line not found');
    const row = await this.prisma.budgetForecastLine.update({
      where: { id },
      data: {
        ...(input.month !== undefined ? { month: input.month } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
      },
      include: { budget: { select: { id: true, name: true, year: true, branchId: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.forecast.updated',
      entityType: 'BudgetForecastLine',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toForecast(row);
  }

  async removeForecastLine(id: string, user: AuthUser) {
    const existing = await this.prisma.budgetForecastLine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forecast line not found');
    await this.prisma.budgetForecastLine.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'finance_ops.forecast.deleted',
      entityType: 'BudgetForecastLine',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Derived reports ---

  async cashFlow(query: FinanceOpsReportQuery, scope: BranchScope) {
    const branchId = getSingleBranchId(scope) ?? query.branchId;
    if (!branchId) throw new BadRequestException('A single branch is required for cash flow');
    const dateFilter = this.dateRange(query.from, query.to);
    const vouchers = await this.prisma.journalVoucher.findMany({
      where: {
        branchId,
        status: 'posted',
        voucherType: { in: ['receipt', 'payment'] },
        ...(dateFilter ? { voucherDate: dateFilter } : {}),
      },
      include: { lines: { include: { account: { select: { code: true, type: true } } } } },
      orderBy: { voucherDate: 'asc' },
    });

    const months = new Map<string, { month: string; receipts: number; payments: number }>();
    for (const voucher of vouchers) {
      const month = voucher.voucherDate.toISOString().slice(0, 7);
      const current = months.get(month) ?? { month, receipts: 0, payments: 0 };
      const cashMovement = voucher.lines
        .filter((line) => line.account.code === '1000' || line.account.code === '1100')
        .reduce((sum, line) => sum + asNumber(line.debit) - asNumber(line.credit), 0);
      if (voucher.voucherType === 'receipt') current.receipts += Math.abs(cashMovement);
      if (voucher.voucherType === 'payment') current.payments += Math.abs(cashMovement);
      months.set(month, current);
    }

    const rows = [...months.values()].map((row) => ({
      ...row,
      net: row.receipts - row.payments,
    }));
    return {
      branchId,
      from: query.from ?? null,
      to: query.to ?? null,
      rows,
      totals: {
        receipts: rows.reduce((sum, row) => sum + row.receipts, 0),
        payments: rows.reduce((sum, row) => sum + row.payments, 0),
        net: rows.reduce((sum, row) => sum + row.net, 0),
      },
    };
  }

  async profitability(query: FinanceOpsReportQuery, scope: BranchScope) {
    const branchId = getSingleBranchId(scope) ?? query.branchId;
    if (!branchId) throw new BadRequestException('A single branch is required for campus profitability');
    const dateFilter = this.dateRange(query.from, query.to);
    const lines = await this.prisma.journalLine.findMany({
      where: {
        voucher: {
          status: 'posted',
          branchId,
          ...(dateFilter ? { voucherDate: dateFilter } : {}),
        },
      },
      include: { account: { select: { code: true, name: true, type: true } } },
    });
    let income = 0;
    let expense = 0;
    let drawings = 0;
    for (const line of lines) {
      if (line.account.code === DRAWINGS_ACCOUNT_CODE) {
        drawings += asNumber(line.debit) - asNumber(line.credit);
      } else if (line.account.type === 'income') {
        income += asNumber(line.credit) - asNumber(line.debit);
      } else if (line.account.type === 'expense') {
        expense += asNumber(line.debit) - asNumber(line.credit);
      }
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    return {
      branchId,
      branchName: branch?.name ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      income,
      expense,
      drawings,
      net: income - expense - drawings,
    };
  }

  async financialRisk(query: FinanceOpsReportQuery, scope: BranchScope) {
    const branchId = getSingleBranchId(scope) ?? query.branchId;
    if (!branchId) throw new BadRequestException('A single branch is required for financial risk');
    const now = new Date();

    const [invoices, bills, cashLines, lastPayroll] = await Promise.all([
      this.prisma.feeInvoice.findMany({
        where: { branchId, paidAt: null },
        include: { payments: { where: { status: 'succeeded' } } },
      }),
      this.prisma.vendorBill.findMany({
        where: { branchId, deletedAt: null, status: { in: ['open', 'partial'] } },
        include: { vendor: vendorSelect },
      }),
      this.prisma.journalLine.findMany({
        where: {
          account: { code: '1000', branchId: null, isSystem: true },
          voucher: { status: 'posted', branchId },
        },
      }),
      this.prisma.payrollRun.findFirst({
        where: { branchId, status: 'finalized' },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { lines: true },
      }),
    ]);

    const overdueReceivables = invoices
      .filter((inv) => inv.dueDate && inv.dueDate < now)
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce((inner, p) => inner + asNumber(p.amount), 0);
        return sum + Math.max(0, asNumber(inv.netAmount) - paid);
      }, 0);

    const unpaidPayables = bills.reduce(
      (sum, bill) => sum + Math.max(0, asNumber(bill.amount) - asNumber(bill.paidAmount)),
      0,
    );

    const cashBalance = cashLines.reduce((sum, line) => sum + asNumber(line.debit) - asNumber(line.credit), 0);
    const lastPayrollNet = lastPayroll
      ? lastPayroll.lines.reduce((sum, line) => sum + asNumber(line.netPay), 0)
      : 0;

    const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
    for (const bill of bills) {
      const remaining = Math.max(0, asNumber(bill.amount) - asNumber(bill.paidAmount));
      const due = bill.dueDate ?? bill.billDate;
      const days = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
      if (days <= 0) aging.current += remaining;
      else if (days <= 30) aging.days30 += remaining;
      else if (days <= 60) aging.days60 += remaining;
      else aging.days90 += remaining;
    }

    const byVendor = new Map<string, number>();
    for (const bill of bills) {
      const remaining = Math.max(0, asNumber(bill.amount) - asNumber(bill.paidAmount));
      byVendor.set(bill.vendor.name, (byVendor.get(bill.vendor.name) ?? 0) + remaining);
    }
    const topVendor = [...byVendor.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      branchId,
      overdueReceivables,
      unpaidPayables,
      cashBalance,
      lastPayrollNet,
      cashToPayrollRatio: lastPayrollNet > 0 ? Math.round((cashBalance / lastPayrollNet) * 100) / 100 : null,
      apAging: aging,
      topVendorShare:
        topVendor && unpaidPayables > 0
          ? { vendor: topVendor[0], amount: topVendor[1], share: Math.round((topVendor[1] / unpaidPayables) * 1000) / 10 }
          : null,
    };
  }

  private dateRange(from?: string, to?: string) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = parseYmd(from, 'from date');
    if (to) {
      const end = parseYmd(to, 'to date');
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private async page<T, R>(
    delegate: {
      findMany: (args: object) => Promise<T[]>;
      count: (args: object) => Promise<number>;
    },
    where: object,
    orderBy: object,
    query: { page?: number; limit?: number },
    map: (row: T) => R,
    include?: object,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        ...(include ? { include } : {}),
      }),
      delegate.count({ where }),
    ]);
    return paginatedResult(rows.map(map), total, page, limit);
  }

  private async requireVendor(id: string, scope: BranchScope) {
    const row = await this.prisma.vendor.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Vendor not found');
    return row;
  }

  private async requireBill(id: string, scope: BranchScope) {
    const row = await this.prisma.vendorBill.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { vendor: vendorSelect, payments: true },
    });
    if (!row) throw new NotFoundException('Vendor bill not found');
    return row;
  }

  private async requireFund(id: string, scope: BranchScope) {
    const row = await this.prisma.pettyCashFund.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Petty cash fund not found');
    return row;
  }

  private async requireStatement(id: string, scope: BranchScope) {
    const row = await this.prisma.bankStatement.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { account: namedSelect, lines: statementLineInclude },
    });
    if (!row) throw new NotFoundException('Cheque register not found');
    return row;
  }

  private async requirePo(id: string, scope: BranchScope) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { vendor: vendorSelect, lines: true, receipts: true },
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return row;
  }

  private async requireAsset(id: string, scope: BranchScope) {
    const row = await this.prisma.fixedAsset.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { batch: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Asset not found');
    return row;
  }

  private toVendor(row: {
    id: string;
    branchId: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toBill(row: {
    id: string;
    branchId: string;
    vendorId: string;
    billNo: string | null;
    billDate: Date;
    dueDate: Date | null;
    amount: Prisma.Decimal | number;
    paidAmount: Prisma.Decimal | number;
    category: string;
    status: string;
    description: string | null;
    journalVoucherId: string | null;
    purchaseOrderId: string | null;
    createdAt: Date;
    updatedAt: Date;
    vendor?: { id: string; name: string };
    payments?: Array<{ id: string; amount: Prisma.Decimal | number; paidAt: Date }>;
  }) {
    const amount = asNumber(row.amount);
    const paidAmount = asNumber(row.paidAmount);
    return {
      id: row.id,
      branchId: row.branchId,
      vendorId: row.vendorId,
      billNo: row.billNo,
      billDate: toYmd(row.billDate),
      dueDate: toYmd(row.dueDate),
      amount,
      paidAmount,
      remainingAmount: Math.max(0, amount - paidAmount),
      category: row.category,
      status: row.status,
      description: row.description,
      journalVoucherId: row.journalVoucherId,
      purchaseOrderId: row.purchaseOrderId,
      vendor: row.vendor,
      payments: (row.payments ?? []).map((p) => ({
        id: p.id,
        amount: asNumber(p.amount),
        paidAt: toYmd(p.paidAt),
      })),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toFund(row: {
    id: string;
    branchId: string;
    name: string;
    openingBalance: Prisma.Decimal | number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      openingBalance: asNumber(row.openingBalance),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toPettyVoucher(row: {
    id: string;
    fundId: string;
    branchId: string;
    voucherDate: Date;
    amount: Prisma.Decimal | number;
    payee: string;
    description: string;
    journalVoucherId: string | null;
    createdAt: Date;
    updatedAt: Date;
    fund?: { id: string; name: string };
  }) {
    return {
      id: row.id,
      fundId: row.fundId,
      branchId: row.branchId,
      voucherDate: toYmd(row.voucherDate),
      amount: asNumber(row.amount),
      payee: row.payee,
      description: row.description,
      journalVoucherId: row.journalVoucherId,
      fund: row.fund,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toStatement(row: {
    id: string;
    branchId: string;
    accountId: string | null;
    year: number;
    month: number;
    bankName: string;
    chequeBookNo: string;
    chequeBookSerialFrom: string | null;
    chequeBookSerialTo: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    account?: { id: string; name: string; code: string } | null;
    lines?: Array<{
      id: string;
      issueDate: Date;
      chequeNumber: string;
      payee: string;
      onAccountOf: string;
      amount: Prisma.Decimal | number;
      useInCampus: string | null;
      clearingDate: Date | null;
      matchedJournalLineId: string | null;
      matchedFeePaymentId: string | null;
    }>;
  }) {
    const lines = (row.lines ?? []).map((line) => this.toStatementLine(line));
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const serialFrom = row.chequeBookSerialFrom || lines[0]?.chequeNumber || null;
    const serialTo = row.chequeBookSerialTo || lines[lines.length - 1]?.chequeNumber || null;
    return {
      id: row.id,
      branchId: row.branchId,
      accountId: row.accountId,
      year: row.year,
      month: row.month,
      monthLabel: monthLabel(row.year, row.month),
      bankName: row.bankName,
      chequeBookNo: row.chequeBookNo,
      chequeBookSerialFrom: serialFrom,
      chequeBookSerialTo: serialTo,
      serialRange: serialFrom && serialTo ? `${serialFrom} to ${serialTo}` : serialFrom || serialTo || null,
      status: row.status,
      account: row.account,
      matchedCount: lines.filter((l) => l.matched).length,
      lineCount: lines.length,
      total,
      lines,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toStatementLine(row: {
    id: string;
    issueDate: Date;
    chequeNumber: string;
    payee: string;
    onAccountOf: string;
    amount: Prisma.Decimal | number;
    useInCampus?: string | null;
    clearingDate?: Date | null;
    matchedJournalLineId: string | null;
    matchedFeePaymentId: string | null;
  }) {
    return {
      id: row.id,
      issueDate: toYmd(row.issueDate),
      chequeNumber: row.chequeNumber,
      payee: row.payee,
      onAccountOf: row.onAccountOf,
      amount: asNumber(row.amount),
      useInCampus: row.useInCampus ?? null,
      clearingDate: row.clearingDate ? toYmd(row.clearingDate) : null,
      matchedJournalLineId: row.matchedJournalLineId,
      matchedFeePaymentId: row.matchedFeePaymentId,
      matched: Boolean(row.matchedJournalLineId || row.matchedFeePaymentId),
    };
  }

  private toDrawing(row: {
    id: string;
    branchId: string;
    drawingDate: Date;
    payee: string;
    amount: Prisma.Decimal | number;
    method: string;
    chequeNumber: string | null;
    notes: string | null;
    journalVoucherId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      drawingDate: toYmd(row.drawingDate),
      payee: row.payee,
      amount: asNumber(row.amount),
      method: row.method,
      chequeNumber: row.chequeNumber,
      notes: row.notes,
      journalVoucherId: row.journalVoucherId,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toPo(row: {
    id: string;
    branchId: string;
    vendorId: string;
    poNo: string;
    orderDate: Date;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    vendor?: { id: string; name: string };
    lines?: Array<{
      id: string;
      description: string;
      quantity: Prisma.Decimal | number;
      unitCost: Prisma.Decimal | number;
    }>;
    receipts?: Array<{ id: string; receivedAt: Date; notes: string | null }>;
  }) {
    const lines = (row.lines ?? []).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: asNumber(line.quantity),
      unitCost: asNumber(line.unitCost),
      amount: asNumber(line.quantity) * asNumber(line.unitCost),
    }));
    return {
      id: row.id,
      branchId: row.branchId,
      vendorId: row.vendorId,
      poNo: row.poNo,
      orderDate: toYmd(row.orderDate),
      status: row.status,
      notes: row.notes,
      vendor: row.vendor,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
      lines,
      receipts: (row.receipts ?? []).map((r) => ({
        id: r.id,
        receivedAt: toYmd(r.receivedAt),
        notes: r.notes,
      })),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toAsset(row: {
    id: string;
    branchId: string;
    name: string;
    category: string;
    scope?: string;
    quantity?: number;
    batchId?: string | null;
    purchaseDate: Date | null;
    cost: Prisma.Decimal | number;
    vendorBillId: string | null;
    purchaseOrderId: string | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    batch?: { id: string; name: string } | null;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      category: row.category,
      scope: row.scope ?? 'school',
      quantity: row.quantity ?? 1,
      batchId: row.batchId ?? null,
      batch: row.batch ?? null,
      purchaseDate: toYmd(row.purchaseDate),
      cost: asNumber(row.cost),
      vendorBillId: row.vendorBillId,
      purchaseOrderId: row.purchaseOrderId,
      status: row.status,
      notes: row.notes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toForecast(row: {
    id: string;
    budgetId: string;
    month: number;
    amount: Prisma.Decimal | number;
    createdAt: Date;
    updatedAt: Date;
    budget?: { id: string; name: string; year: number; branchId: string | null };
  }) {
    return {
      id: row.id,
      budgetId: row.budgetId,
      month: row.month,
      amount: asNumber(row.amount),
      budget: row.budget,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }
}
