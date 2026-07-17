import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

export async function seedPayroll(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const branchId = ctx.branchMap.get('MAIN') ?? ctx.branchMap.values().next().value;
  if (!branchId) return;

  const preferredEmails = ['ahmed.teacher@nexium.edu.pk', 'fees@nexium.edu.pk'];
  const emails =
    preferredEmails.filter((e) => ctx.userIds.has(e)).length > 0
      ? preferredEmails.filter((e) => ctx.userIds.has(e))
      : [...ctx.userIds.keys()]
          .filter((e) => !e.includes('parent') && !e.includes('ali.khan'))
          .slice(0, 2);

  const now = new Date();
  const priorMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const priorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const effectiveFrom = new Date(Date.UTC(priorYear, priorMonth - 1, 1));

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
          basicSalary: email.startsWith('ahmed') ? 80000 : 75000,
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

  if (structures.length === 0) return;

  let run = await prisma.payrollRun.findUnique({
    where: {
      branchId_year_month: { branchId, year: priorYear, month: priorMonth },
    },
  });

  if (!run) {
    run = await prisma.payrollRun.create({
      data: {
        branchId,
        year: priorYear,
        month: priorMonth,
        status: 'finalized',
        finalizedAt: new Date(),
        notes: 'Demo payroll run',
      },
    });
  }

  for (const s of structures) {
    const existing = await prisma.payrollLine.findUnique({
      where: { runId_userId: { runId: run.id, userId: s.userId } },
    });
    if (existing) continue;

    const allowances = 5000;
    const deductions = 2000;
    const net = s.basic + allowances - deductions;
    await prisma.payrollLine.create({
      data: {
        runId: run.id,
        userId: s.userId,
        basicSalary: s.basic,
        allowancesTotal: allowances,
        deductionsTotal: deductions,
        adjustmentsTotal: 0,
        netPay: net,
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
}
