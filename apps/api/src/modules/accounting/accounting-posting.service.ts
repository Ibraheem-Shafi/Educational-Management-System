import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';

const DEFAULT_SYSTEM_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Bank', type: 'asset' },
  { code: '1600', name: 'Fixed Assets', type: 'asset' },
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '4000', name: 'Fee Income', type: 'income' },
  { code: '5000', name: 'Salary Expense', type: 'expense' },
  { code: '5100', name: 'Operating Expense', type: 'expense' },
  { code: '5200', name: 'Utilities Expense', type: 'expense' },
  { code: '5300', name: 'Maintenance Expense', type: 'expense' },
] as const;

/**
 * Auto-posting helpers for fee payments and payroll runs.
 * PayrollModule should import AccountingModule and call postPayrollRun after finalize.
 */
@Injectable()
export class AccountingPostingService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultChart();
  }

  async ensureDefaultChart() {
    for (const account of DEFAULT_SYSTEM_ACCOUNTS) {
      const existing = await this.prisma.account.findFirst({
        where: { code: account.code, branchId: null, isSystem: true },
      });
      if (existing) {
        await this.prisma.account.update({
          where: { id: existing.id },
          data: {
            name: account.name,
            type: account.type,
            isSystem: true,
            isActive: true,
            deletedAt: null,
          },
        });
        continue;
      }
      await this.prisma.account.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type,
          branchId: null,
          isSystem: true,
          isActive: true,
        },
      });
    }
  }

  private async getSystemAccount(code: string) {
    await this.ensureDefaultChart();
    const account = await this.prisma.account.findFirst({
      where: { code, branchId: null, isSystem: true, deletedAt: null },
    });
    if (!account) {
      throw new BadRequestException(`System account ${code} is not configured`);
    }
    return account;
  }

  private async nextVoucherNo(branchId: string, voucherType: string): Promise<string> {
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

  async postFeePayment(
    paymentId: string,
    branchId: string,
    amount: number,
    userId?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    const existing = await this.prisma.journalVoucher.findFirst({
      where: { sourceType: 'fee_payment', sourceId: paymentId, status: 'posted' },
    });
    if (existing) return existing;

    const payment = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      select: { invoice: { select: { feeTypeId: true } } },
    });
    if (!payment) {
      throw new BadRequestException('Fee payment not found');
    }

    const [cash, feeIncome] = await Promise.all([
      this.getSystemAccount('1000'),
      this.getSystemAccount('4000'),
    ]);

    const now = new Date();
    const voucherNo = await this.nextVoucherNo(branchId, 'receipt');

    return this.prisma.journalVoucher.create({
      data: {
        branchId,
        voucherType: 'receipt',
        voucherNo,
        voucherDate: now,
        narration: `Fee payment ${paymentId}`,
        status: 'posted',
        sourceType: 'fee_payment',
        sourceId: paymentId,
        feeTypeId: payment.invoice.feeTypeId,
        postedAt: now,
        createdById: userId,
        lines: {
          create: [
            { accountId: cash.id, debit: amount, credit: 0 },
            { accountId: feeIncome.id, debit: 0, credit: amount },
          ],
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async postPayrollRun(
    runId: string,
    branchId: string,
    totalNet: number,
    userId?: string,
  ) {
    if (totalNet <= 0) {
      throw new BadRequestException('Payroll total must be positive');
    }

    const existing = await this.prisma.journalVoucher.findFirst({
      where: { sourceType: 'payroll_run', sourceId: runId, status: 'posted' },
    });
    if (existing) return existing;

    const [salaryExpense, cash] = await Promise.all([
      this.getSystemAccount('5000'),
      this.getSystemAccount('1000'),
    ]);

    const now = new Date();
    const voucherNo = await this.nextVoucherNo(branchId, 'payment');

    return this.prisma.journalVoucher.create({
      data: {
        branchId,
        voucherType: 'payment',
        voucherNo,
        voucherDate: now,
        narration: `Payroll run ${runId}`,
        status: 'posted',
        sourceType: 'payroll_run',
        sourceId: runId,
        postedAt: now,
        createdById: userId,
        lines: {
          create: [
            { accountId: salaryExpense.id, debit: totalNet, credit: 0 },
            { accountId: cash.id, debit: 0, credit: totalNet },
          ],
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async postDoubleEntry(opts: {
    branchId: string;
    voucherType: 'receipt' | 'payment' | 'journal';
    sourceType: string;
    sourceId: string;
    narration: string;
    debitAccountCode: string;
    creditAccountCode: string;
    amount: number;
    userId?: string;
    voucherDate?: Date;
  }) {
    if (opts.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const existing = await this.prisma.journalVoucher.findFirst({
      where: { sourceType: opts.sourceType, sourceId: opts.sourceId, status: 'posted' },
    });
    if (existing) return existing;

    const [debitAccount, creditAccount] = await Promise.all([
      this.getSystemAccount(opts.debitAccountCode),
      this.getSystemAccount(opts.creditAccountCode),
    ]);

    const now = opts.voucherDate ?? new Date();
    const voucherNo = await this.nextVoucherNo(opts.branchId, opts.voucherType);

    return this.prisma.journalVoucher.create({
      data: {
        branchId: opts.branchId,
        voucherType: opts.voucherType,
        voucherNo,
        voucherDate: now,
        narration: opts.narration,
        status: 'posted',
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
        postedAt: new Date(),
        createdById: opts.userId,
        lines: {
          create: [
            { accountId: debitAccount.id, debit: opts.amount, credit: 0 },
            { accountId: creditAccount.id, debit: 0, credit: opts.amount },
          ],
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });
  }
}
