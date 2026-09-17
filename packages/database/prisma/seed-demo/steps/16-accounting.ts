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

  await seedShahwaliChequeRegister(prisma, ctx);
}

async function seedShahwaliChequeRegister(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const branchId = ctx.branchMap.get('SWC') ?? ctx.branchMap.get('MAIN');
  if (!branchId) return;

  const existing = await prisma.bankStatement.findFirst({
    where: { branchId, year: 2026, month: 8, bankName: 'Al Flah Bank', deletedAt: null },
  });
  if (!existing) {
    await prisma.bankStatement.create({
      data: {
        branchId,
        year: 2026,
        month: 8,
        bankName: 'Al Flah Bank',
        chequeBookSerialFrom: '46267817',
        chequeBookSerialTo: '46267825',
        status: 'open',
        lines: {
          create: [
            { issueDate: new Date('2026-08-04'), chequeNumber: '46267817', payee: 'Bakhshish Ellahi', onAccountOf: 'Salary', amount: 18500 },
            { issueDate: new Date('2026-08-10'), chequeNumber: '46267818', payee: 'Nosheen', onAccountOf: 'Salary Staff', amount: 112400 },
            { issueDate: new Date('2026-08-11'), chequeNumber: '46267819', payee: 'Nosheen', onAccountOf: 'Petty Cash', amount: 10000 },
            { issueDate: new Date('2026-08-11'), chequeNumber: '46267820', payee: 'Nosheen', onAccountOf: 'Mobile + Ptcl', amount: 5000 },
            { issueDate: new Date('2026-08-13'), chequeNumber: '46267821', payee: 'Nosheen', onAccountOf: 'Staff Salary', amount: 30350 },
            { issueDate: new Date('2026-08-20'), chequeNumber: '46267822', payee: 'Zahid Hussain', onAccountOf: 'Building Rent', amount: 95000 },
            { issueDate: new Date('2026-08-21'), chequeNumber: '46267823', payee: 'Hasham Ali', onAccountOf: 'Labour Work', amount: 33400 },
            { issueDate: new Date('2026-08-24'), chequeNumber: '46267824', payee: 'Bakhshish Ellahi', onAccountOf: 'Advance Salary', amount: 18500 },
            { issueDate: new Date('2026-08-25'), chequeNumber: '46267825', payee: 'Saeed Butt', onAccountOf: 'By Sir Anjum', amount: 20000 },
          ],
        },
      },
    });
  }

  let drawingsAccount = await prisma.account.findFirst({
    where: { code: '3000', branchId: null, deletedAt: null },
  });
  if (!drawingsAccount) {
    drawingsAccount = await prisma.account.create({
      data: { code: '3000', name: 'Drawings', type: 'equity', branchId: null, isSystem: true, isActive: true },
    });
  }
  let bankAccount = await prisma.account.findFirst({
    where: { code: '1100', branchId: null, deletedAt: null },
  });
  if (!bankAccount) {
    bankAccount = await prisma.account.create({
      data: { code: '1100', name: 'Bank', type: 'asset', branchId: null, isSystem: true, isActive: true },
    });
  }

  const drawing = await prisma.ownerDrawing.findFirst({
    where: { branchId, chequeNumber: '46267825', deletedAt: null },
  });
  if (drawing) return;

  const created = await prisma.ownerDrawing.create({
    data: {
      branchId,
      drawingDate: new Date('2026-08-25'),
      payee: 'Saeed Butt',
      amount: 20000,
      method: 'cheque',
      chequeNumber: '46267825',
      notes: 'By Sir Anjum',
    },
  });

  const voucherNo = 'PAY-2026-DRAW-001';
  const existingVoucher = await prisma.journalVoucher.findUnique({
    where: { branchId_voucherNo: { branchId, voucherNo } },
  });
  if (existingVoucher) {
    await prisma.ownerDrawing.update({
      where: { id: created.id },
      data: { journalVoucherId: existingVoucher.id },
    });
    return;
  }

  const voucher = await prisma.journalVoucher.create({
    data: {
      branchId,
      voucherType: 'payment',
      voucherNo,
      voucherDate: new Date('2026-08-25'),
      narration: 'Owner drawing — Saeed Butt (By Sir Anjum)',
      status: 'posted',
      sourceType: 'owner_drawing',
      sourceId: created.id,
      postedAt: new Date('2026-08-25'),
      lines: {
        create: [
          { accountId: drawingsAccount.id, debit: 20000, credit: 0 },
          { accountId: bankAccount.id, debit: 0, credit: 20000 },
        ],
      },
    },
  });
  await prisma.ownerDrawing.update({
    where: { id: created.id },
    data: { journalVoucherId: voucher.id },
  });
}
