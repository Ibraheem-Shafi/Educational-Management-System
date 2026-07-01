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
