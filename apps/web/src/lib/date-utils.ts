/** Local calendar-day helpers for date inputs (YYYY-MM-DD). */

/** Today's date as `YYYY-MM-DD` in the local timezone. */
export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Current local month as `YYYY-MM`. */
export function currentYearMonth(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Format a stored calendar day (YYYY-MM-DD or ISO noon-UTC) without shifting the day. */
export function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return '—';
  const ymd = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString();
  }
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Extract `YYYY-MM-DD` from a date or datetime-local value. */
export function toYmd(value: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** True when `value` is a calendar day strictly before today (local). */
export function isPastYmd(value: string, now = new Date()): boolean {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd < todayYmd(now);
}

/** True when year/month is strictly before the current local month. */
export function isPastYearMonth(year: number, month: number, now = new Date()): boolean {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  if (year < currentYear) return true;
  if (year > currentYear) return false;
  return month < currentMonth;
}
