import type { PrismaClient } from '@prisma/client';
import { computeSalarySheetLine, DEFAULT_EXTRA_LEC_RATE } from '@eims/shared';
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

  const jobs: {
    branchCode: string;
    emails: { email: string; basic: number; group: 'permanent' | 'admin'; eobi: number }[];
  }[] = [
    ...configuredBranchCodes(ctx).map((branchCode) => ({
      branchCode,
      emails: [
        { email: staffEmail(branchCode, 'teacher'), basic: 80000, group: 'permanent' as const, eobi: 600 },
        { email: staffEmail(branchCode, 'accountant'), basic: 75000, group: 'admin' as const, eobi: 0 },
      ].filter((row): row is { email: string; basic: number; group: 'permanent' | 'admin'; eobi: number } =>
        !!row.email && ctx.userIds.has(row.email),
      ),
    })),
    ...swcFinanceDummyBranchCodes(ctx).map((branchCode) => ({
      branchCode,
      emails: [
        { email: staffEmail(branchCode, 'fee_collector'), basic: 75000, group: 'admin' as const, eobi: 0 },
        { email: staffEmail(branchCode, 'hr_finance'), basic: 85000, group: 'admin' as const, eobi: 0 },
      ].filter((row): row is { email: string; basic: number; group: 'permanent' | 'admin'; eobi: number } =>
        !!row.email && ctx.userIds.has(row.email),
      ),
    })),
  ];

  for (const { branchCode, emails } of jobs) {
    const branchId = ctx.branchMap.get(branchCode);
    if (!branchId || emails.length === 0) continue;

    const structures: {
      userId: string;
      basic: number;
      group: 'permanent' | 'admin';
      eobi: number;
    }[] = [];

    for (const { email, basic, group, eobi } of emails) {
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
            staffGroup: group,
            eobi,
            pessi: 0,
            extraLecRate: DEFAULT_EXTRA_LEC_RATE,
            effectiveFrom,
            isActive: true,
          },
        });
      } else {
        await prisma.salaryStructure.update({
          where: { id: structure.id },
          data: { staffGroup: group, eobi },
        });
      }
      structures.push({ userId, basic: Number(structure.basicSalary), group, eobi });
    }

    if (structures.length === 0) continue;

    let paid = await prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId, year: priorYear, month: priorMonth },
      },
    });

    if (!paid) {
      paid = await prisma.payrollRun.create({
        data: {
          branchId,
          year: priorYear,
          month: priorMonth,
          status: 'paid',
          finalizedAt: new Date(),
          paidAt: new Date(),
          paymentMethod: 'bank',
          notes: `Demo salary sheet (${branchCode})`,
        },
      });
    } else if (!paid.paidAt) {
      paid = await prisma.payrollRun.update({
        where: { id: paid.id },
        data: { status: 'paid', paidAt: paid.finalizedAt ?? new Date(), paymentMethod: 'bank' },
      });
    }

    for (const s of structures) {
      const existing = await prisma.payrollLine.findUnique({
        where: { runId_userId: { runId: paid.id, userId: s.userId } },
      });
      if (existing) continue;

      const absents = 2;
      const computed = computeSalarySheetLine({
        staffGroup: s.group,
        basicSalary: s.basic,
        absents,
        extraLectures: 0,
        extraLecRate: DEFAULT_EXTRA_LEC_RATE,
        lectureCount: 0,
        ratePerClass: 0,
        otherAllowance: 0,
        advanceDeduction: 0,
        securityDeduct: 0,
        eobi: s.eobi,
        pessi: 0,
        previousAdvance: 0,
        currentAdvance: 0,
        securityPrevious: 0,
      });

      await prisma.payrollLine.create({
        data: {
          runId: paid.id,
          userId: s.userId,
          staffGroup: s.group,
          basicSalary: s.basic,
          allowancesTotal: computed.allowancesTotal,
          deductionsTotal: computed.deductionsTotal,
          adjustmentsTotal: 0,
          netPay: computed.netPay,
          attendancePresentDays: 20,
          attendanceAbsentDays: absents,
          workingDays: computed.workingDays,
          absents,
          deductedDays: computed.deductedDays,
          extraLecRate: DEFAULT_EXTRA_LEC_RATE,
          extraLecAmount: computed.extraLecAmount,
          absentFine: computed.absentFine,
          eobi: s.eobi,
          pendingAdvance: computed.pendingAdvance,
          securityTillDate: computed.securityTillDate,
        },
      });
    }

    let open = await prisma.payrollRun.findUnique({
      where: {
        branchId_year_month: { branchId, year: currentYear, month: currentMonth },
      },
    });
    if (!open) {
      open = await prisma.payrollRun.create({
        data: {
          branchId,
          year: currentYear,
          month: currentMonth,
          status: 'open',
          notes: `Demo open salary sheet (${branchCode})`,
        },
      });
    } else if (open.status === 'draft') {
      open = await prisma.payrollRun.update({
        where: { id: open.id },
        data: { status: 'open' },
      });
    }

    for (const s of structures) {
      const existing = await prisma.payrollLine.findUnique({
        where: { runId_userId: { runId: open.id, userId: s.userId } },
      });
      if (existing) continue;

      const absents = 1;
      const computed = computeSalarySheetLine({
        staffGroup: s.group,
        basicSalary: s.basic,
        absents,
        extraLectures: 0,
        extraLecRate: DEFAULT_EXTRA_LEC_RATE,
        lectureCount: 0,
        ratePerClass: 0,
        otherAllowance: 0,
        advanceDeduction: 0,
        securityDeduct: 0,
        eobi: s.eobi,
        pessi: 0,
        previousAdvance: 0,
        currentAdvance: 0,
        securityPrevious: 0,
      });

      await prisma.payrollLine.create({
        data: {
          runId: open.id,
          userId: s.userId,
          staffGroup: s.group,
          basicSalary: s.basic,
          allowancesTotal: computed.allowancesTotal,
          deductionsTotal: computed.deductionsTotal,
          adjustmentsTotal: 0,
          netPay: computed.netPay,
          attendancePresentDays: 12,
          attendanceAbsentDays: absents,
          workingDays: computed.workingDays,
          absents,
          deductedDays: computed.deductedDays,
          extraLecRate: DEFAULT_EXTRA_LEC_RATE,
          extraLecAmount: computed.extraLecAmount,
          absentFine: computed.absentFine,
          eobi: s.eobi,
          pendingAdvance: computed.pendingAdvance,
          securityTillDate: computed.securityTillDate,
        },
      });
    }
  }
}
