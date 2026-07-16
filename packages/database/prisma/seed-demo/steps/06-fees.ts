import { Prisma, type PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

export async function seedFees(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const accountantId = ctx.userIds.get('fees@nexium.edu.pk') ?? null;

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

  const mainBranch = ctx.branchMap.get('MAIN')!;
  const monthlyFeeTypeId = ctx.feeTypeMap.get('monthly')!;
  const demoStudentIds = [...ctx.studentIds.values()];
  const students = await prisma.student.findMany({
    where: {
      id: { in: demoStudentIds },
      branchId: mainBranch,
      deletedAt: null,
    },
    take: 30,
  });

  const now = new Date();
  const invoiceRows: Prisma.FeeInvoiceCreateManyInput[] = [];

  for (const student of students) {
    const demoKey = (student.customFields as { _demoKey?: string })._demoKey;
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 10));
      const amount = 25000;
      let statusCode = 'paid';
      let paidAt: Date | null = new Date(due);
      paidAt.setDate(paidAt.getDate() + 2);

      if (monthOffset === 0) {
        statusCode = 'pending';
        paidAt = null;
      } else if (monthOffset === 1) {
        statusCode = 'overdue';
        paidAt = null;
      }

      const discount =
        demoKey === 'zainab-hussain' ? new Prisma.Decimal(2500) : new Prisma.Decimal(0);
      const fine = statusCode === 'overdue' ? new Prisma.Decimal(500) : new Prisma.Decimal(0);
      const net = new Prisma.Decimal(amount).minus(discount).plus(fine);

      invoiceRows.push({
        branchId: mainBranch,
        studentId: student.id,
        feeTypeId: monthlyFeeTypeId,
        amount,
        discount,
        fine,
        netAmount: net,
        dueDate: due,
        paidAt,
        statusId: ctx.statusIds.fee[statusCode],
        remarks: statusCode === 'overdue' ? 'Late fee applied after 7-day grace period' : null,
        createdById: accountantId,
      });
    }
  }

  for (const row of invoiceRows) {
    const exists = await prisma.feeInvoice.findFirst({
      where: {
        studentId: row.studentId,
        feeTypeId: row.feeTypeId,
        dueDate: row.dueDate as Date,
      },
    });
    if (!exists) {
      await prisma.feeInvoice.create({ data: row });
    }
  }
}
