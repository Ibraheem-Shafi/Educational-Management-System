import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSlotBaseSchema = z.object({
  branchId: z.string().min(1),
  batchId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().optional(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  room: z.string().max(100).optional(),
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
  room: z.string().optional(),
  view: z.enum(['batch', 'teacher', 'room']).optional(),
});

export type ListTimetableQuery = z.infer<typeof listTimetableQuerySchema>;
