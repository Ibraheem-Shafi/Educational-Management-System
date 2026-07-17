import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const attendanceSheetQuerySchema = z.object({
  date: dateOnlySchema,
  batchId: z.string().min(1),
  branchId: z.string().optional(),
});

export type AttendanceSheetQuery = z.infer<typeof attendanceSheetQuerySchema>;

export const bulkAttendanceSchema = z.object({
  branchId: z.string().min(1),
  date: dateOnlySchema,
  batchId: z.string().optional(),
  /** When true (default), notify linked parents for students marked absent. */
  notifyAbsences: z.boolean().optional().default(true),
  notifyChannel: z.enum(['sms', 'whatsapp']).optional().default('sms'),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        statusId: z.string().min(1),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;

export const attendanceHistoryQuerySchema = z.object({
  studentId: z.string().min(1),
  from: dateOnlySchema,
  to: dateOnlySchema,
});

export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM');

export const attendanceGridQuerySchema = z
  .object({
    month: monthSchema,
    branchId: z.string().optional(),
    entityType: z.enum(['student', 'teacher', 'staff']).default('student'),
    batchId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.entityType === 'student' && !value.batchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'batchId is required for student attendance grid',
        path: ['batchId'],
      });
    }
  });

export type AttendanceGridQuery = z.infer<typeof attendanceGridQuerySchema>;

export const ATTENDANCE_ENTITY_STUDENT = 'student' as const;
export const ATTENDANCE_ENTITY_TEACHER = 'teacher' as const;
export const ATTENDANCE_ENTITY_STAFF = 'staff' as const;

export const staffAttendanceSheetQuerySchema = z.object({
  date: dateOnlySchema,
  branchId: z.string().min(1),
  entityType: z.enum(['teacher', 'staff']),
});

export type StaffAttendanceSheetQuery = z.infer<typeof staffAttendanceSheetQuerySchema>;

export const bulkStaffAttendanceSchema = z.object({
  branchId: z.string().min(1),
  date: dateOnlySchema,
  entityType: z.enum(['teacher', 'staff']),
  records: z
    .array(
      z.object({
        userId: z.string().min(1),
        statusId: z.string().min(1),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export type BulkStaffAttendanceInput = z.infer<typeof bulkStaffAttendanceSchema>;
