/** Persist a calendar day without shifting it in PK (UTC+5). */
export function parseCalendarDate(value: string): Date {
  const ymd = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return new Date(`${ymd}T12:00:00.000Z`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date');
  }
  return parsed;
}

export function currentBillingPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function billingPeriodFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function sanitizeVoucherToken(value: string): string {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'X';
}

export function formatMonthlyVoucherNo(opts: {
  branchCode: string;
  admissionNumber: string | null;
  rollNumber: string | null;
  studentId: string;
  billingPeriod: string;
}): string {
  const code = sanitizeVoucherToken(opts.branchCode).slice(0, 8);
  const studentPart = opts.admissionNumber
    ? sanitizeVoucherToken(opts.admissionNumber)
    : opts.rollNumber
      ? `ROLL-${sanitizeVoucherToken(opts.rollNumber)}`
      : opts.studentId.slice(-6).toUpperCase();
  return `${code}-${studentPart}-${opts.billingPeriod}`;
}

export function applyFeeIncrement(
  amount: number,
  mode: 'percent' | 'amount',
  value: number,
): number {
  const next = mode === 'percent' ? amount * (1 + value / 100) : amount + value;
  return Math.round((Math.max(0, next) + Number.EPSILON) * 100) / 100;
}
