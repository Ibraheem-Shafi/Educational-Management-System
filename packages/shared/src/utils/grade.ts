/** Indian/Pakistani digit grouping: 12,34,56,789 */
export function formatNumberPk(
  amount: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const minFrac = options?.minimumFractionDigits ?? 0;
  const maxFrac = options?.maximumFractionDigits ?? 2;
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const rounded =
    maxFrac === 0
      ? Math.round(abs)
      : Math.round(abs * 10 ** maxFrac) / 10 ** maxFrac;

  let [intPart, fracPart = ''] = rounded.toFixed(maxFrac).split('.');
  if (maxFrac > 0) {
    fracPart = fracPart.replace(/0+$/, '');
    if (fracPart.length < minFrac) {
      fracPart = fracPart.padEnd(minFrac, '0');
    }
  } else {
    fracPart = '';
  }

  const grouped = groupIndian(intPart.replace(/^0+(?=\d)/, '') || '0');
  const fraction = fracPart ? `.${fracPart}` : '';
  return `${neg ? '-' : ''}${grouped}${fraction}`;
}

function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  let rest = intDigits.slice(0, -3);
  const pairs: string[] = [];
  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) pairs.unshift(rest);
  return `${pairs.join(',')},${last3}`;
}

/** Full currency for tables, receipts, tooltips — e.g. Rs 14,26,500 */
export function formatCurrency(amount: number, _currency = 'PKR'): string {
  return `Rs ${formatNumberPk(amount, { maximumFractionDigits: 2 })}`;
}

const LAKH = 100_000;
const CRORE = 10_000_000;

function formatCompactUnit(value: number): string {
  const fixed = value.toFixed(2).replace(/\.?0+$/, '');
  return fixed;
}

/**
 * Compact currency for stats cards — e.g. Rs 14.27 Lakh, Rs 1.5 Cr.
 * Amounts under 1 lakh stay fully expanded.
 */
export function formatCurrencyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= CRORE) {
    return `${sign}Rs ${formatCompactUnit(abs / CRORE)} Cr`;
  }
  if (abs >= LAKH) {
    return `${sign}Rs ${formatCompactUnit(abs / LAKH)} Lakh`;
  }
  return formatCurrency(amount);
}

/** Display + hover title pair for MainStatsSection currency tiles. */
export function currencyStat(amount: number): { value: string; title: string } {
  return {
    value: formatCurrencyCompact(amount),
    title: formatCurrency(amount),
  };
}

export function calculatePercentage(obtained: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((obtained / total) * 10000) / 100;
}

export function calculateGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}
