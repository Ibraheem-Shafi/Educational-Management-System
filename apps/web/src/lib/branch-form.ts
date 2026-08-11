import { normalizePakistanPhone } from '@eims/shared';

export interface BranchFormValues {
  name: string;
  code: string;
  address: string;
  email: string;
  phone: string;
}

export const emptyBranchForm: BranchFormValues = {
  name: '',
  code: '',
  address: '',
  email: '',
  phone: '',
};

export function slugifyBranchCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
}

export function formatBranchPhone(phone: string | null): string {
  if (!phone) return '—';
  const normalized = normalizePakistanPhone(phone);
  if (normalized.startsWith('+92') && normalized.length > 3) {
    return `+92 ${normalized.slice(3)}`;
  }
  return phone;
}

export function buildBranchPhonePayload(form: BranchFormValues): string | undefined {
  const trimmed = form.phone.trim();
  if (!trimmed) return undefined;
  return normalizePakistanPhone(trimmed);
}

export function formatBranchId(code: string): string {
  return `BR-${code.toUpperCase()}`;
}
