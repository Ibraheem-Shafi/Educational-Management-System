import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
} from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Empty string → null so the UI can clear an assigned teacher. Omitted stays undefined (PATCH). */
const optionalTeacherId = z
  .union([z.string().min(1), z.literal(''), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === '') return null;
    return v;
  });

const timetableSlotBaseSchema = z.object({
  branchId: requiredId('Branch'),
  batchId: requiredId('Batch'),
  subjectId: requiredId('Subject'),
  teacherId: optionalTeacherId,
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(timeRegex, 'Enter a valid time (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Enter a valid time (HH:MM)'),
  room: optionalString(100).nullable(),
});

export const createTimetableSlotSchema = refineEndAfterStart(
  timetableSlotBaseSchema,
  'startTime',
  'endTime',
  { message: MSG.endTimeAfterStart },
);

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;

const bulkSlotFieldsSchema = timetableSlotBaseSchema.omit({ dayOfWeek: true }).extend({
  daysOfWeek: z
    .array(z.number().int().min(1).max(7))
    .min(1, MSG.required('Days'))
    .max(7)
    .refine((days) => new Set(days).size === days.length, {
      message: 'Duplicate days are not allowed',
    }),
});

export const createTimetableSlotsBulkSchema = refineEndAfterStart(
  bulkSlotFieldsSchema,
  'startTime',
  'endTime',
  { message: MSG.endTimeAfterStart },
);

export type CreateTimetableSlotsBulkInput = z.infer<typeof createTimetableSlotsBulkSchema>;

export const updateTimetableSlotSchema = refineEndAfterStart(
  timetableSlotBaseSchema.omit({ branchId: true }).partial(),
  'startTime',
  'endTime',
  { message: MSG.endTimeAfterStart },
);

export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;

export const listTimetableQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  teacherId: z.string().optional(),
  subjectId: z.string().optional(),
  room: z.string().optional(),
});

export type ListTimetableQuery = z.infer<typeof listTimetableQuerySchema>;
