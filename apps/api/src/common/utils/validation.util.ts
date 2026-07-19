import type { ZodError } from 'zod';
import { getFirstZodError } from '@eims/shared';

export function getFirstValidationMessage(error: ZodError): string {
  return getFirstZodError(error);
}

export function buildValidationExceptionBody(error: ZodError) {
  return {
    message: getFirstZodError(error),
    details: error.flatten().fieldErrors,
  };
}
