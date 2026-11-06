import type { ImportColumnMapping, ImportMappingPayload } from '@eims/shared';

export type RawSheetRow = Record<string, unknown>;

export function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function cellToNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function mapRow(
  raw: RawSheetRow,
  columns: ImportColumnMapping,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(columns)) {
    if (!header) continue;
    out[field] = cellToString(raw[header]);
  }
  return out;
}

export function parseDayOfWeek(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const asNum = Number(v);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 7) return asNum;
  const map: Record<string, number> = {
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
    sun: 7,
    sunday: 7,
  };
  return map[v] ?? null;
}

export function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'y' || v === 'yes' || v === 'true' || v === 'link';
}

/** Parse school-sheet dates (D/M/Y, D-M-YYYY, ISO, Excel serial). Returns null if unusable. */
export function parseFlexibleDate(raw: string | undefined | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    // Excel serial day counts (roughly 1950–2100)
    if (n > 18000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    // If first part is clearly a month (US M/D/Y), swap
    if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Take the first phone-like token (sheets often stuff two numbers in one cell). */
export function normalizeImportPhone(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const parts = s.split(/[\s,/|;]+/).filter(Boolean);
  const first =
    parts.find((p) => p.replace(/\D/g, '').length >= 7) ?? parts[0] ?? null;
  if (!first) return null;
  return first.slice(0, 40);
}

const HEADER_LABEL_MARKERS = new Set([
  'en. no.',
  'en no',
  'en.no.',
  'enrollment no',
  'admission number',
  'student name',
  'sr. no.',
  'sr no',
  'father name',
  'date of birth',
  'new class',
  'contact no',
  'contact no.',
]);

/** True when the mapped row is clearly the spreadsheet header, not a student. */
export function looksLikeHeaderMappedRow(mapped: Record<string, string>): boolean {
  const adm = mapped.admissionNumber?.trim().toLowerCase() ?? '';
  const name = mapped.fullName?.trim().toLowerCase() ?? '';
  if (HEADER_LABEL_MARKERS.has(adm) || HEADER_LABEL_MARKERS.has(name)) return true;
  if (adm.includes('en.') && adm.includes('no')) return true;
  if (name === 'student name' || name === 'name') return true;
  return false;
}

export function normalizeTime(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function asMapping(mapping: unknown): ImportMappingPayload {
  if (!mapping || typeof mapping !== 'object') return { columns: {} };
  const m = mapping as ImportMappingPayload;
  return {
    columns: m.columns ?? {},
    monthGroups: m.monthGroups,
  };
}

export function randomTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  let out = 'Imp!';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
