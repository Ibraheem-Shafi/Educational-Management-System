import {
  normalizePakistanPhone,
  validateSchema,
} from '@eims/shared';

export { normalizePakistanPhone, validateSchema };

const API_PATH_ALIASES: Record<string, string> = {
  'guardians.0.phone': 'guardianPhone',
  'guardians.0.email': 'guardianEmail',
  'guardians.0.cnic': 'guardianCnic',
  'guardians.0.fullName': 'guardianFullName',
  'guardians.1.phone': 'emergencyPhone',
  'guardians.1.fullName': 'emergencyFullName',
};

function resolveFieldKey(key: string): string {
  return API_PATH_ALIASES[key] ?? key;
}

export function flattenFieldErrors(errors: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const field = resolveFieldKey(key);
    if (!result[field]) {
      result[field] = message;
    }
  }
  return result;
}

export function mapApiDetailsToFields(
  details: Record<string, string[]> | undefined,
): Record<string, string> {
  if (!details) return {};
  const raw: Record<string, string> = {};
  for (const [key, messages] of Object.entries(details)) {
    const message = messages?.[0];
    if (message) {
      raw[key] = message;
    }
  }
  return flattenFieldErrors(raw);
}
