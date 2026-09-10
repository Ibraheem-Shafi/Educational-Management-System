import type { DemoContext } from './types';

export const DEMO_BRANCH_CODES = ['MAIN', 'LAHORE'] as const;
export type DemoBranchCode = (typeof DEMO_BRANCH_CODES)[number];

export const SHAHWALI_BRANCH_CODE = 'SWC';

export type DemoStaffKind =
  | 'teacher'
  | 'accountant'
  | 'receptionist'
  | 'branch_admin'
  | 'fee_collector'
  | 'hr_finance';

export function configuredBranchCodes(ctx: DemoContext): string[] {
  const fromBatches = new Set(ctx.config.batches.map((b) => b.branchCode));
  return DEMO_BRANCH_CODES.filter((code) => ctx.branchMap.has(code) && fromBatches.has(code));
}

/** Shahwali is not a full demo campus (imported fees). Only HR/payroll/accounting dummy. */
export function swcFinanceDummyBranchCodes(ctx: DemoContext): string[] {
  return ctx.branchMap.has(SHAHWALI_BRANCH_CODE) ? [SHAHWALI_BRANCH_CODE] : [];
}

export function staffEmail(branchCode: string, role: DemoStaffKind): string | null {
  const map: Record<string, Partial<Record<DemoStaffKind, string>>> = {
    MAIN: {
      teacher: 'ahmed.teacher@nexium.edu.pk',
      accountant: 'fees@nexium.edu.pk',
      receptionist: 'reception@nexium.edu.pk',
      branch_admin: 'branchadmin@nexium.edu.pk',
    },
    LAHORE: {
      teacher: 'lahore.teacher@nexium.edu.pk',
      accountant: 'lahore.fees@nexium.edu.pk',
      receptionist: 'lahore.reception@nexium.edu.pk',
      branch_admin: 'lahore.admin@nexium.edu.pk',
    },
    SWC: {
      fee_collector: 'shahwali.fees@nexium.edu.pk',
      hr_finance: 'shahwali.hr@nexium.edu.pk',
    },
  };
  return map[branchCode]?.[role] ?? null;
}

export function staffUserId(
  ctx: DemoContext,
  branchCode: string,
  role: DemoStaffKind,
): string | null {
  const email = staffEmail(branchCode, role);
  if (!email) return null;
  return ctx.userIds.get(email) ?? null;
}

export function featuredStudentDemoKey(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'ahmed-hassan' : 'ali-khan';
}

export function secondaryStudentDemoKey(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'sara-ahmed' : 'ayesha-malik';
}

export function firstBatchCode(ctx: DemoContext, branchCode: string): string | null {
  return ctx.config.batches.find((b) => b.branchCode === branchCode)?.code ?? null;
}

export function monthlyFeeAmount(ctx: DemoContext, branchCode: string, programCode: string): number {
  const structure = ctx.config.feeStructures.find(
    (f) => f.branchCode === branchCode && f.programCode === programCode && f.feeTypeCode === 'monthly',
  );
  return structure?.amount ?? 25000;
}
