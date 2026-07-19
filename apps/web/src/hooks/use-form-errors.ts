'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ZodSchema } from 'zod';
import { cn } from '@/lib/utils';
import {
  flattenFieldErrors,
  mapApiDetailsToFields,
  validateSchema,
} from '@/lib/form-validation';

export function useFormErrors<T>(schema: ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearField = useCallback((name: string) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setErrors({});
  }, []);

  const setFieldError = useCallback((name: string, message: string) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  const validate = useCallback(
    (data: unknown): boolean => {
      const result = validateSchema(schema, data);
      if (result.success) {
        setErrors({});
        return true;
      }
      setErrors(flattenFieldErrors(result.fieldErrors));
      return false;
    },
    [schema],
  );

  const applyApiErrors = useCallback(
    (details: Record<string, string[]> | undefined): boolean => {
      const mapped = mapApiDetailsToFields(details);
      if (Object.keys(mapped).length === 0) return false;
      setErrors(mapped);
      return true;
    },
    [],
  );

  const fieldClassName = useCallback(
    (field: string, baseClass: string): string => {
      return cn(baseClass, errors[field] && 'border-red-500');
    },
    [errors],
  );

  const firstErrorField = useMemo(() => {
    const keys = Object.keys(errors);
    return keys.length > 0 ? keys[0] : null;
  }, [errors]);

  return {
    errors,
    clearField,
    clearAll,
    setFieldError,
    validate,
    applyApiErrors,
    fieldClassName,
    firstErrorField,
  };
}
