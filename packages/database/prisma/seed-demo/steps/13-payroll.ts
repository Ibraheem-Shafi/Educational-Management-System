import type { PrismaClient } from '@prisma/client';
import { configuredBranchCodes, staffEmail } from '../branch-helpers';
import type { DemoContext } from '../types';

export async function seedPayroll(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const now = new Date();
  const priorMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const priorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const effectiveFrom = new Date(Date.UTC(priorYear, priorMonth - 1, 1));

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const emails = [
      staffEmail(branchCode, 'teacher'),
      staffEmail(branchCode, 'accountant'),
    ].filter((e): e is string => !!e && ctx.userIds.has(e));

    const structures: { userId: string; basic: number }[] = [];

    for (const email of emails) {
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
            basicSalary: email.includes('teacher') ? 80000 : 75000,
            effectiveFrom,
            isActive: true,
            components: {
              create: [
                { kind: 'allowance', name: 'Transport', amount: 5000 },
                { kind: 'deduction', name: 'Tax', amount: 2000 },
              ],
            },
          },
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
          notes: `Demo payroll run (${branchCode})`,
        },
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
            allowances: [{ name: 'Transport', amount: allowances }],
            deductions: [{ name: 'Tax', amount: deductions }],
          },
        },
      });
    }

    // Current-month draft run so approve/submit can be demoed
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
            allowances: [{ name: 'Transport', amount: allowances }],
            deductions: [{ name: 'Tax', amount: deductions }],
          },
        },
      });
    }
  }
}
