import { Prisma, type PrismaClient } from '@prisma/client';
import { configuredBranchCodes, staffUserId, swcFinanceDummyBranchCodes } from '../branch-helpers';
import type { DemoContext } from '../types';

const SYSTEM_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '4000', name: 'Fee Revenue', type: 'income' },
  { code: '5000', name: 'Operating Expense', type: 'expense' },
] as const;

export async function seedAccounting(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  // Ensure global system accounts exist (normally created by API boot)
  for (const account of SYSTEM_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { code: account.code, branchId: null, deletedAt: null },
    });
    if (!existing) {
      await prisma.account.create({
        data: {
          branchId: null,
          code: account.code,
          name: account.name,
          type: account.type,
          isSystem: true,
          isActive: true,
        },
      });
    }
  }

  const cash = await prisma.account.findFirst({
    where: { code: '1000', branchId: null, deletedAt: null },
  });
  const revenue = await prisma.account.findFirst({
    where: { code: '4000', branchId: null, deletedAt: null },
  });
  const expense = await prisma.account.findFirst({
    where: { code: '5000', branchId: null, deletedAt: null },
  });
  if (!cash || !revenue || !expense) return;

  const year = new Date().getUTCFullYear();

  for (const branchCode of [...configuredBranchCodes(ctx), ...swcFinanceDummyBranchCodes(ctx)]) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const accountantId =
      branchCode === 'SWC'
        ? staffUserId(ctx, branchCode, 'hr_finance')
        : staffUserId(ctx, branchCode, 'accountant');

    // Branch-level utility account (non-system)
    const utilCode =
      branchCode === 'LAHORE' ? '5100-LHR' : branchCode === 'SWC' ? '5100-SWC' : '5100-ISB';
    let utilAccount = await prisma.account.findFirst({
      where: { code: utilCode, branchId, deletedAt: null },
    });
    if (!utilAccount) {
      utilAccount = await prisma.account.create({
        data: {
          branchId,
          code: utilCode,
          name: `${branchCode} Utilities`,
          type: 'expense',
          isSystem: false,
          isActive: true,
        },
      });
    }

    const postedNo = `JV-${branchCode}-DEMO-001`;
    const draftNo = `JV-${branchCode}-DEMO-002`;

    let posted = await prisma.journalVoucher.findUnique({
      where: { branchId_voucherNo: { branchId, voucherNo: postedNo } },
    });
    if (!posted) {
      posted = await prisma.journalVoucher.create({
        data: {
          branchId,
          voucherType: 'journal',
          voucherNo: postedNo,
          voucherDate: new Date(Date.UTC(year, 5, 15)),
          narration: `Demo fee collection posting (${branchCode})`,
          status: 'posted',
          sourceType: 'demo',
          postedAt: new Date(Date.UTC(year, 5, 15)),
          createdById: accountantId,
          lines: {
            create: [
              {
                accountId: cash.id,
                debit: new Prisma.Decimal(150000),
                credit: new Prisma.Decimal(0),
                memo: 'Cash received',
              },
              {
                accountId: revenue.id,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(150000),
                memo: 'Fee revenue',
              },
            ],
          },
        },
      });
    }

    let draft = await prisma.journalVoucher.findUnique({
      where: { branchId_voucherNo: { branchId, voucherNo: draftNo } },
    });
    if (!draft) {
      draft = await prisma.journalVoucher.create({
        data: {
          branchId,
          voucherType: 'payment',
          voucherNo: draftNo,
          voucherDate: new Date(Date.UTC(year, 6, 1)),
          narration: `Demo utility payment draft (${branchCode})`,
          status: 'draft',
          sourceType: 'demo',
          createdById: accountantId,
          lines: {
            create: [
              {
                accountId: utilAccount.id,
                debit: new Prisma.Decimal(25000),
                credit: new Prisma.Decimal(0),
                memo: 'Utilities',
              },
              {
                accountId: cash.id,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(25000),
                memo: 'Cash payment',
              },
            ],
          },
        },
      });
    }

    const budgetName = `${year} Operating Budget [${branchCode}]`;
    let budget = await prisma.budget.findFirst({
      where: { branchId, year, name: budgetName },
    });
    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          branchId,
          year,
          name: budgetName,
          lines: {
            create: [
              { accountId: revenue.id, amount: new Prisma.Decimal(5_000_000) },
              { accountId: expense.id, amount: new Prisma.Decimal(1_200_000) },
              { accountId: utilAccount.id, amount: new Prisma.Decimal(300_000) },
            ],
          },
        },
      });
    }

    void posted;
    void draft;
    void budget;
  }
}
