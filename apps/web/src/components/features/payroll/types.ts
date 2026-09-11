import type { SalaryComponentKind } from '@eims/shared';

export type { SalaryComponentKind };

export interface SalaryComponent {
  id?: string;
  kind: SalaryComponentKind;
  name: string;
  amount: number;
  percentOfBasic: number | null;
}

export interface SalaryStructure {
  id: string;
  userId: string;
  branchId: string;
  basicSalary: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  user?: { id: string; fullName: string; staffCode: string };
  components: SalaryComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunSummary {
  id: string;
  branchId: string;
  year: number;
  month: number;
  status: string;
  approvedById: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  notes: string | null;
  lineCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollBreakdownComponent {
  kind: string;
  name: string;
  amount: number;
  percentOfBasic?: number | null;
  group?: string;
}

export interface PayrollBreakdown {
  components: PayrollBreakdownComponent[];
  fullBasicSalary: number | null;
  unpaidAbsentDays: number | null;
  paidLeaveDays: number | null;
  lwpAmount: number | null;
  adjustmentReason: string | null;
  attendanceNotMarked: boolean;
}

export interface PayrollLine {
  id: string;
  runId: string;
  userId: string;
  basicSalary: number;
  allowancesTotal: number;
  deductionsTotal: number;
  adjustmentsTotal: number;
  netPay: number;
  attendancePresentDays: number;
  attendanceAbsentDays: number;
  workingDays: number;
  breakdown: unknown;
  user?: { id: string; fullName: string; staffCode: string };
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunDetail extends PayrollRunSummary {
  lines: PayrollLine[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatPeriod(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusBadgeCode(status: string): string {
  switch (status) {
    case 'draft':
      return 'inactive';
    case 'pending_approval':
      return 'pending';
    case 'approved':
      return 'active';
    case 'finalized':
      return 'completed';
    default:
      return status;
  }
}

export function historyStatusLabel(run: Pick<PayrollRunSummary, 'status' | 'paidAt' | 'paymentMethod'>): {
  label: string;
  code: string;
} {
  if (run.paidAt) {
    return {
      label: run.paymentMethod ? `Paid (${formatLabel(run.paymentMethod)})` : 'Paid',
      code: 'completed',
    };
  }
  if (run.status === 'finalized') {
    return { label: 'Finalized — unpaid', code: 'pending' };
  }
  return { label: formatLabel(run.status), code: statusBadgeCode(run.status) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parsePayrollBreakdown(breakdown: unknown): PayrollBreakdown {
  const empty: PayrollBreakdown = {
    components: [],
    fullBasicSalary: null,
    unpaidAbsentDays: null,
    paidLeaveDays: null,
    lwpAmount: null,
    adjustmentReason: null,
    attendanceNotMarked: false,
  };
  if (!isRecord(breakdown)) return empty;

  let components: PayrollBreakdownComponent[] = [];
  if (Array.isArray(breakdown.components)) {
    components = breakdown.components.filter(isRecord).map((c) => ({
      kind: String(c.kind ?? 'deduction'),
      name: String(c.name ?? ''),
      amount: Number(c.amount) || 0,
      percentOfBasic: c.percentOfBasic != null ? Number(c.percentOfBasic) : null,
      group: typeof c.group === 'string' ? c.group : undefined,
    }));
  } else {
    const allowances = Array.isArray(breakdown.allowances) ? breakdown.allowances : [];
    const deductions = Array.isArray(breakdown.deductions) ? breakdown.deductions : [];
    components = [
      ...allowances.filter(isRecord).map((c) => ({
        kind: 'allowance',
        name: String(c.name ?? ''),
        amount: Number(c.amount) || 0,
        percentOfBasic: null,
        group: 'allowance',
      })),
      ...deductions.filter(isRecord).map((c) => ({
        kind: 'deduction',
        name: String(c.name ?? ''),
        amount: Number(c.amount) || 0,
        percentOfBasic: null,
        group: 'deduction',
      })),
    ];
  }

  const lwpFromComponents = components.find((c) => c.group === 'lwp' || c.name === 'Leave without pay');

  return {
    components,
    fullBasicSalary: typeof breakdown.fullBasicSalary === 'number' ? breakdown.fullBasicSalary : null,
    unpaidAbsentDays: typeof breakdown.unpaidAbsentDays === 'number' ? breakdown.unpaidAbsentDays : null,
    paidLeaveDays: typeof breakdown.paidLeaveDays === 'number' ? breakdown.paidLeaveDays : null,
    lwpAmount:
      typeof breakdown.lwpAmount === 'number' ? breakdown.lwpAmount : (lwpFromComponents?.amount ?? null),
    adjustmentReason: typeof breakdown.adjustmentReason === 'string' ? breakdown.adjustmentReason : null,
    attendanceNotMarked: breakdown.attendanceNotMarked === true,
  };
}

export function lineGross(line: Pick<PayrollLine, 'basicSalary' | 'allowancesTotal'>): number {
  return line.basicSalary + line.allowancesTotal;
}
