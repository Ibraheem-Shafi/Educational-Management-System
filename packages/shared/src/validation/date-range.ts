import { z } from 'zod';
import { MSG } from './messages';

type DateRangeOptions = {
  /** When true, end may equal start (leave / filters). Default false = end must be strictly after start. */
  allowEqual?: boolean;
  /** Override default end-field message. */
  message?: string;
};

/**
 * Zod refine: when both start and end are present (non-empty), end must be after start
 * (or on/after if allowEqual). Error path is the end field for form binding.
 */
export function refineEndAfterStart<T extends z.ZodTypeAny>(
  schema: T,
  startKey: string,
  endKey: string,
  options: DateRangeOptions = {},
): z.ZodEffects<T> {
  const allowEqual = options.allowEqual === true;
  const message =
    options.message ?? (allowEqual ? MSG.endOnOrAfterStart : MSG.endAfterStart);

  return schema.refine(
    (data) => {
      const record = data as Record<string, unknown>;
      const start = record[startKey];
      const end = record[endKey];
      if (start == null || end == null || start === '' || end === '') return true;
      const startStr = String(start);
      const endStr = String(end);
      return allowEqual ? endStr >= startStr : endStr > startStr;
    },
    { message, path: [endKey] },
  );
}
