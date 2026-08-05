import { Prisma, type PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  monthlyFeeAmount,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

export async function seedFees(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const structure of ctx.config.feeStructures) {
    const branchId = ctx.branchMap.get(structure.branchCode)!;
    const programId = ctx.programMap.get(`${structure.branchCode}:${structure.programCode}`)!;
    const feeTypeId = ctx.feeTypeMap.get(structure.feeTypeCode)!;

    const existing = await prisma.feeStructure.findFirst({
      where: { branchId, feeTypeId, programId },
    });
    if (!existing) {
      await prisma.feeStructure.create({
        data: {
          branchId,
          feeTypeId,
          programId,
          amount: structure.amount,
          dueDayOfMonth: structure.dueDayOfMonth ?? null,
        },
      });
    }
  }

  const monthlyFeeTypeId = ctx.feeTypeMap.get('monthly')!;
  const now = new Date();

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const accountantId = staffUserId(ctx, branchCode, 'accountant');
    const students = await prisma.student.findMany({
      where: {
        id: { in: [...ctx.studentIds.values()] },
        branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        customFields: true,
        batch: { select: { program: { select: { code: true } } } },
      },
      take: 30,
    });

    for (const student of students) {
      const demoKey = (student.customFields as { _demoKey?: string })._demoKey;
      const programCode = student.batch?.program?.code ?? 'MDCAT';
      const amount = monthlyFeeAmount(ctx, branchCode, programCode);

      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 10));
        let statusCode = 'paid';
        let paidAt: Date | null = new Date(due);
        paidAt.setUTCDate(paidAt.getUTCDate() + 2);

        if (monthOffset === 0) {
          statusCode = 'pending';
          paidAt = null;
        } else if (monthOffset === 1) {
          statusCode = 'overdue';
          paidAt = null;
        }

        const discount =
          demoKey === 'zainab-hussain' || demoKey === featuredStudentDemoKey(branchCode)
            ? new Prisma.Decimal(demoKey === 'zainab-hussain' ? 2500 : 0)
            : new Prisma.Decimal(0);
        const fine = statusCode === 'overdue' ? new Prisma.Decimal(500) : new Prisma.Decimal(0);
        const net = new Prisma.Decimal(amount).minus(discount).plus(fine);

        const exists = await prisma.feeInvoice.findFirst({
          where: {
            studentId: student.id,
            feeTypeId: monthlyFeeTypeId,
            dueDate: due,
          },
        });
        if (exists) {
          if (exists.paidAt && statusCode === 'paid') {
            await ensureFeePayment(prisma, exists.id, branchId, Number(exists.netAmount), accountantId, exists.paidAt);
          }
          continue;
        }

        const invoice = await prisma.feeInvoice.create({
          data: {
            branchId,
            studentId: student.id,
            feeTypeId: monthlyFeeTypeId,
            invoiceNo: `INV-${branchCode}-${due.getUTCFullYear()}${String(due.getUTCMonth() + 1).padStart(2, '0')}-${student.id.slice(-6).toUpperCase()}`,
            amount,
            discount,
            fine,
            netAmount: net,
            dueDate: due,
            paidAt,
            statusId: ctx.statusIds.fee[statusCode],
            remarks: statusCode === 'overdue' ? 'Late fee applied after 7-day grace period' : null,
            createdById: accountantId,
          },
        });

        if (paidAt) {
          await ensureFeePayment(prisma, invoice.id, branchId, Number(net), accountantId, paidAt);
        }
      }
    }
  }
}

async function ensureFeePayment(
  prisma: PrismaClient,
  invoiceId: string,
  branchId: string,
  amount: number,
  recordedById: string | null,
  paidAt: Date,
): Promise<void> {
  const existing = await prisma.feePayment.findFirst({
    where: { invoiceId, status: 'completed' },
  });
  if (existing) return;

  await prisma.feePayment.create({
    data: {
      invoiceId,
      branchId,
      receiptNo: `RCP-${invoiceId.slice(-10).toUpperCase()}`,
      amount,
      method: 'cash',
      provider: 'manual',
      providerRef: `DEMO-PAY-${invoiceId.slice(-8)}`,
      status: 'completed',
      paidAt,
      recordedById,
      meta: { _demo: true },
    },
  });
}
