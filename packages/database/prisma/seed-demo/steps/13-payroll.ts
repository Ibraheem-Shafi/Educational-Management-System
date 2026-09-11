import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  staffEmail,
  swcFinanceDummyBranchCodes,
} from '../branch-helpers';
import type { DemoContext } from '../types';

export async function seedPayroll(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const now = new Date();
  const priorMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const priorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const effectiveFrom = new Date(Date.UTC(priorYear, priorMonth - 1, 1));

  const jobs: { branchCode: string; emails: { email: string; basic: number }[] }[] = [
    ...configuredBranchCodes(ctx).map((branchCode) => ({
      branchCode,
      emails: [
        { email: staffEmail(branchCode, 'teacher'), basic: 80000 },
        { email: staffEmail(branchCode, 'accountant'), basic: 75000 },
      ].filter((row): row is { email: string; basic: number } => !!row.email && ctx.userIds.has(row.email)),
    })),
    ...swcFinanceDummyBranchCodes(ctx).map((branchCode) => ({
      branchCode,
      emails: [
        { email: staffEmail(branchCode, 'fee_collector'), basic: 75000 },
        { email: staffEmail(branchCode, 'hr_finance'), basic: 85000 },
      ].filter((row): row is { email: string; basic: number } => !!row.email && ctx.userIds.has(row.email)),
    })),
  ];

  for (const { branchCode, emails } of jobs) {
    const branchId = ctx.branchMap.get(branchCode);
    if (!branchId || emails.length === 0) continue;

    const structures: { userId: string; basic: number }[] = [];

    for (const { email, basic } of emails) {
      const userId = ctx.userIds.get(email);
      if (!userId) continue;

      let structure = await prisma.salaryStructure.findFirst({
        where: { userId, branchId, deletedAt: null, isActive: true },
      });
      if (!structure) {
        structure = await prisma.salaryStructure.create({
          data: {
            userId,
            branchId,
            basicSalary: basic,
            effectiveFrom,
            isActive: true,
            components: {
              create: [
                { kind: 'allowance', name: 'Transport', amount: 5000 },
                { kind: 'tax', name: 'Tax', amount: 2000 },
              ],
            },
          },
        });
      } else {
        await prisma.salaryComponent.updateMany({
          where: { structureId: structure.id, name: 'Tax', kind: 'deduction' },
          data: { kind: 'tax' },
        });
      }
      structures.push({ userId, basic: Number(structure.basicSalary) });
    }

    if (structures.length === 0) continue;

    let finalized = await prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId, year: priorYear, month: priorMonth },
      },
    });

    if (!finalized) {
      finalized = await prisma.payrollRun.create({
        data: {
          branchId,
          year: priorYear,
          month: priorMonth,
          status: 'finalized',
          finalizedAt: new Date(),
          paidAt: new Date(),
          paymentMethod: 'bank',
          notes: `Demo payroll run (${branchCode})`,
        },
      });
    } else if (!finalized.paidAt) {
      finalized = await prisma.payrollRun.update({
        where: { id: finalized.id },
        data: { paidAt: finalized.finalizedAt ?? new Date(), paymentMethod: 'bank' },
      });
    }

    for (const s of structures) {
      const existing = await prisma.payrollLine.findUnique({
        where: { runId_userId: { runId: finalized.id, userId: s.userId } },
      });
      if (existing) continue;

      const allowances = 5000;
      const deductions = 2000;
      await prisma.payrollLine.create({
        data: {
          runId: finalized.id,
          userId: s.userId,
          basicSalary: s.basic,
          allowancesTotal: allowances,
          deductionsTotal: deductions,
          adjustmentsTotal: 0,
          netPay: s.basic + allowances - deductions,
          attendancePresentDays: 20,
          attendanceAbsentDays: 2,
          workingDays: 22,
          breakdown: {
            components: [
              { kind: 'allowance', name: 'Transport', amount: allowances, percentOfBasic: null, group: 'allowance' },
              { kind: 'tax', name: 'Tax', amount: deductions, percentOfBasic: null, group: 'statutory' },
            ],
            fullBasicSalary: s.basic,
            unpaidAbsentDays: 2,
            paidLeaveDays: 0,
            lwpAmount: 0,
            attendanceNotMarked: false,
          },
        },
      });
    }

    let draft = await prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId, year: currentYear, month: currentMonth },
      },
    });
    if (!draft) {
      draft = await prisma.payrollRun.create({
        data: {
          branchId,
          year: currentYear,
          month: currentMonth,
          status: 'draft',
          notes: `Demo draft payroll (${branchCode})`,
        },
      });
    }

    for (const s of structures) {
      const existing = await prisma.payrollLine.findUnique({
        where: { runId_userId: { runId: draft.id, userId: s.userId } },
      });
      if (existing) continue;

      const allowances = 5000;
      const deductions = 2000;
      await prisma.payrollLine.create({
        data: {
          runId: draft.id,
          userId: s.userId,
          basicSalary: s.basic,
          allowancesTotal: allowances,
          deductionsTotal: deductions,
          adjustmentsTotal: 0,
          netPay: s.basic + allowances - deductions,
          attendancePresentDays: 12,
          attendanceAbsentDays: 1,
          workingDays: 15,
          breakdown: {
            components: [
              { kind: 'allowance', name: 'Transport', amount: allowances, percentOfBasic: null, group: 'allowance' },
              { kind: 'tax', name: 'Tax', amount: deductions, percentOfBasic: null, group: 'statutory' },
            ],
            fullBasicSalary: s.basic,
            unpaidAbsentDays: 1,
            paidLeaveDays: 0,
            lwpAmount: 0,
            attendanceNotMarked: false,
          },
        },
      });
    }
  }
}
