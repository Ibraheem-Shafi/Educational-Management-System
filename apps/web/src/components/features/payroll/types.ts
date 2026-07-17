export interface SalaryComponent {
  id?: string;
  kind: 'allowance' | 'deduction';
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
  notes: string | null;
  lineCount?: number;
  createdAt: string;
  updatedAt: string;
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
