import type { StaffGroup } from '@eims/shared';
import { computeSalarySheetLine } from '@eims/shared';

export type { SalaryComponentKind, StaffGroup } from '@eims/shared';

export interface SalaryComponent {
  id?: string;
  kind: string;
  name: string;
  amount: number;
  percentOfBasic: number | null;
}

export interface SalaryStructure {
  id: string;
  userId: string;
  branchId: string;
  basicSalary: number;
  staffGroup: StaffGroup;
  bankAccount: string | null;
  eobi: number;
  pessi: number;
  extraLecRate: number;
  ratePerClass: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  user?: { id: string; fullName: string; staffCode: string; designation?: string | null };
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

export interface PayrollLine {
  id: string;
  runId: string;
  userId: string;
  staffGroup: StaffGroup;
  designation: string | null;
  accountNumber: string | null;
  basicSalary: number;
  perDay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  adjustmentsTotal: number;
  netPay: number;
  attendancePresentDays: number;
  attendanceAbsentDays: number;
  workingDays: number;
  absents: number;
  deductedDays: number;
  extraLectures: number;
  lectureCount: number;
  ratePerClass: number;
  extraLecRate: number;
  extraLecAmount: number;
  lecturesAmount: number;
  otherAllowance: number;
  entitlementsTotal: number;
  absentFine: number;
  advanceDeduction: number;
  securityDeduct: number;
  eobi: number;
  pessi: number;
  previousAdvance: number;
  currentAdvance: number;
  pendingAdvance: number;
  securityPrevious: number;
  securityTillDate: number;
  remarks: string | null;
  paymentDate: string | null;
  amountIssued: number;
  paymentType: string | null;
  breakdown: unknown;
  user?: { id: string; fullName: string; staffCode: string; designation?: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface PayrollGroupTotals {
  count: number;
  basicSalary: number;
  entitlementsTotal: number;
  deductionsTotal: number;
  netPay: number;
}

export interface PayrollRunDetail extends PayrollRunSummary {
  branch?: { id: string; name: string } | null;
  lines: PayrollLine[];
  totals?: {
    permanent: PayrollGroupTotals;
    admin: PayrollGroupTotals;
    visiting: PayrollGroupTotals;
    grand: PayrollGroupTotals;
  };
}

export const STAFF_GROUP_LABELS: Record<StaffGroup, string> = {
  permanent: 'Permanent Staff',
  admin: 'Admin Staff',
  visiting: 'Visiting Staff',
};

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
    case 'open':
    case 'draft':
      return 'inactive';
    case 'paid':
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
  if (run.paidAt || run.status === 'paid') {
    return {
      label: run.paymentMethod ? `Paid (${formatLabel(run.paymentMethod)})` : 'Paid',
      code: 'completed',
    };
  }
  return { label: 'Open', code: 'inactive' };
}

export function isPayrollPaid(run: Pick<PayrollRunSummary, 'status' | 'paidAt'>): boolean {
  return !!run.paidAt || run.status === 'paid';
}

export function recomputeLine(line: PayrollLine): PayrollLine {
  const computed = computeSalarySheetLine(line);
  return {
    ...line,
    perDay: computed.perDay,
    workingDays: computed.workingDays,
    deductedDays: computed.deductedDays,
    extraLecAmount: computed.extraLecAmount,
    lecturesAmount: computed.lecturesAmount,
    entitlementsTotal: computed.entitlementsTotal,
    allowancesTotal: computed.allowancesTotal,
    absentFine: computed.absentFine,
    deductionsTotal: computed.deductionsTotal,
    netPay: computed.netPay,
    pendingAdvance: computed.pendingAdvance,
    securityTillDate: computed.securityTillDate,
  };
}

export function groupLines(lines: PayrollLine[]): Record<StaffGroup, PayrollLine[]> {
  return {
    permanent: lines.filter((line) => line.staffGroup === 'permanent'),
    admin: lines.filter((line) => line.staffGroup === 'admin'),
    visiting: lines.filter((line) => line.staffGroup === 'visiting'),
  };
}

export function sumLines(lines: PayrollLine[]): PayrollGroupTotals {
  return {
    count: lines.length,
    basicSalary: lines.reduce((sum, line) => sum + line.basicSalary, 0),
    entitlementsTotal: lines.reduce((sum, line) => sum + line.entitlementsTotal, 0),
    deductionsTotal: lines.reduce((sum, line) => sum + line.deductionsTotal, 0),
    netPay: lines.reduce((sum, line) => sum + line.netPay, 0),
  };
}

export function lineGross(line: Pick<PayrollLine, 'basicSalary' | 'allowancesTotal'>): number {
  return line.basicSalary + line.allowancesTotal;
}

export function parsePayrollBreakdown(breakdown: unknown): {
  components: Array<{ kind: string; name: string; amount: number; percentOfBasic?: number | null; group?: string }>;
  fullBasicSalary: number | null;
  unpaidAbsentDays: number | null;
  paidLeaveDays: number | null;
  lwpAmount: number | null;
  adjustmentReason: string | null;
  attendanceNotMarked: boolean;
} {
  const empty = {
    components: [] as Array<{
      kind: string;
      name: string;
      amount: number;
      percentOfBasic?: number | null;
      group?: string;
    }>,
    fullBasicSalary: null as number | null,
    unpaidAbsentDays: null as number | null,
    paidLeaveDays: null as number | null,
    lwpAmount: null as number | null,
    adjustmentReason: null as string | null,
    attendanceNotMarked: false,
  };
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return empty;
  const raw = breakdown as Record<string, unknown>;
  return {
    ...empty,
    fullBasicSalary: typeof raw.fullBasicSalary === 'number' ? raw.fullBasicSalary : null,
    unpaidAbsentDays: typeof raw.unpaidAbsentDays === 'number' ? raw.unpaidAbsentDays : null,
    paidLeaveDays: typeof raw.paidLeaveDays === 'number' ? raw.paidLeaveDays : null,
    lwpAmount: typeof raw.lwpAmount === 'number' ? raw.lwpAmount : null,
    adjustmentReason: typeof raw.adjustmentReason === 'string' ? raw.adjustmentReason : null,
    attendanceNotMarked: raw.attendanceNotMarked === true,
  };
}

export function lineToSavePayload(line: PayrollLine) {
  return {
    id: line.id,
    staffGroup: line.staffGroup,
    designation: line.designation,
    accountNumber: line.accountNumber,
    basicSalary: line.basicSalary,
    absents: line.absents,
    extraLectures: line.extraLectures,
    lectureCount: line.lectureCount,
    ratePerClass: line.ratePerClass,
    extraLecRate: line.extraLecRate,
    otherAllowance: line.otherAllowance,
    advanceDeduction: line.advanceDeduction,
    securityDeduct: line.securityDeduct,
    eobi: line.eobi,
    pessi: line.pessi,
    previousAdvance: line.previousAdvance,
    currentAdvance: line.currentAdvance,
    securityPrevious: line.securityPrevious,
    remarks: line.remarks,
    paymentDate: line.paymentDate,
    amountIssued: line.amountIssued,
    paymentType: line.paymentType,
  };
}
