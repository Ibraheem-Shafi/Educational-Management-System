import { createHash } from 'crypto';

export function deterministicUuid(seed: string): string {
  const h = createHash('sha256').update(`eims-demo:${seed}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function recentWeekdays(count: number, end = new Date()): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(end);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(parseDateOnly(cursor.toISOString().slice(0, 10)));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function hashSeed(...parts: string[]): number {
  const h = createHash('sha256').update(parts.join(':')).digest();
  return h.readUInt32BE(0);
}

export function pct(marks: number, total: number): number {
  return Math.round((marks / total) * 10000) / 100;
}

export function gradeFromPct(p: number): string {
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'F';
}
