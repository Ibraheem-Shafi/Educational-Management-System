import { PHONE_COUNTRY_OPTIONS } from '@/components/features/users/invite-form-fields';

export interface BranchFormValues {
  name: string;
  code: string;
  address: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
}

export const emptyBranchForm: BranchFormValues = {
  name: '',
  code: '',
  address: '',
  email: '',
  phoneCountryCode: '+92',
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

export function parsePhoneForBranchForm(phone: string | null): {
  phoneCountryCode: string;
  phone: string;
} {
  if (!phone) {
    return { phoneCountryCode: '+92', phone: '' };
  }

  const sorted = [...PHONE_COUNTRY_OPTIONS].sort((a, b) => b.value.length - a.value.length);
  for (const option of sorted) {
    if (phone.startsWith(option.value)) {
      return {
        phoneCountryCode: option.value,
        phone: phone.slice(option.value.length).trim(),
      };
    }
  }

  return { phoneCountryCode: '+92', phone };
}

export function formatBranchPhone(phone: string | null): string {
  if (!phone) return '—';
  const { phoneCountryCode, phone: number } = parsePhoneForBranchForm(phone);
  if (!number) return phone;
  return `${phoneCountryCode} ${number}`;
}

export function buildBranchPhonePayload(form: BranchFormValues): string | undefined {
  const phoneDigits = form.phone.replace(/\s/g, '');
  if (!phoneDigits) return undefined;
  return `${form.phoneCountryCode}${phoneDigits.replace(/^0+/, '')}`;
}

export function formatBranchId(code: string): string {
  return `BR-${code.toUpperCase()}`;
}
