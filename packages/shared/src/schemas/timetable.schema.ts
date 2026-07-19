import { z } from 'zod';
import {
  optionalString,
  requiredId,
} from '../validation/messages';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSlotBaseSchema = z.object({
  branchId: requiredId('Branch'),
  batchId: requiredId('Batch'),
  subjectId: requiredId('Subject'),
  teacherId: z.string().optional(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(timeRegex, 'Enter a valid time (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Enter a valid time (HH:MM)'),
  room: optionalString(100),
});

export const createTimetableSlotSchema = timetableSlotBaseSchema.refine(
  (d) => d.endTime > d.startTime,
  { message: 'endTime must be after startTime' },
);

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;

export const updateTimetableSlotSchema = timetableSlotBaseSchema
  .omit({ branchId: true })
  .partial()
  .refine((d) => !d.startTime || !d.endTime || d.endTime > d.startTime, {
    message: 'endTime must be after startTime',
  });

export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;

export const listTimetableQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  teacherId: z.string().optional(),
  subjectId: z.string().optional(),
  room: z.string().optional(),
});

export type ListTimetableQuery = z.infer<typeof listTimetableQuerySchema>;
