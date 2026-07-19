import { ApiClientError } from '@/lib/api-client';

/** Returns true when API validation errors were applied inline (no toast needed). */
export function handleFormValidationError(
  err: Error,
  applyApiErrors: (details: Record<string, string[]> | undefined) => boolean,
): boolean {
  if (err instanceof ApiClientError && applyApiErrors(err.details)) {
    return true;
  }
  return false;
}
