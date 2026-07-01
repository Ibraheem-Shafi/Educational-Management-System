import { z } from 'zod';

export const createAssessmentSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(2).max(200),
  typeId: z.string().min(1),
  seriesId: z.string().optional(),
  sessionId: z.string().optional(),
  totalMarks: z.coerce.number().positive(),
  conductedAt: z.string().datetime().optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const listAssessmentsQuerySchema = z.object({
  branchId: z.string().optional(),
  typeId: z.string().optional(),
});

export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;

export const marksSheetQuerySchema = z.object({
  batchId: z.string().min(1),
});

export type MarksSheetQuery = z.infer<typeof marksSheetQuerySchema>;

export const bulkMarksSchema = z.object({
  batchId: z.string().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        subjectId: z.string().min(1),
        obtainedMarks: z.coerce.number().min(0),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export type BulkMarksInput = z.infer<typeof bulkMarksSchema>;

export const createAssessmentTypeSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(50),
});

export const updateAssessmentTypeSchema = createAssessmentTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAssessmentTypeInput = z.infer<typeof createAssessmentTypeSchema>;
export type UpdateAssessmentTypeInput = z.infer<typeof updateAssessmentTypeSchema>;

export const createAssessmentSeriesSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(50),
});

export const updateAssessmentSeriesSchema = createAssessmentSeriesSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAssessmentSeriesInput = z.infer<typeof createAssessmentSeriesSchema>;
export type UpdateAssessmentSeriesInput = z.infer<typeof updateAssessmentSeriesSchema>;
