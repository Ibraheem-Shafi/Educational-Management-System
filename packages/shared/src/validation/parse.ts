import type { ZodError, ZodSchema } from 'zod';

export type FieldErrors = Record<string, string>;

export type ValidateResult<T> =
  | { success: true; data: T; fieldErrors: FieldErrors; firstError: null }
  | { success: false; data: null; fieldErrors: FieldErrors; firstError: string };

/** Flatten Zod issues into field key → first message map */
export function zodIssuesToFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export function getFirstZodError(error: ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

export function validateSchema<T>(schema: ZodSchema<T>, data: unknown): ValidateResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, fieldErrors: {}, firstError: null };
  }
  const fieldErrors = zodIssuesToFieldErrors(result.error);
  return {
    success: false,
    data: null,
    fieldErrors,
    firstError: getFirstZodError(result.error),
  };
}

/** Normalize Pakistani mobile: 03XXXXXXXXX → +923XXXXXXXXX */
export function normalizePakistanPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+92')) return trimmed;
  if (trimmed.startsWith('92') && trimmed.length === 12) return `+${trimmed}`;
  if (trimmed.startsWith('0') && trimmed.length === 11) return `+92${trimmed.slice(1)}`;
  return trimmed;
}
