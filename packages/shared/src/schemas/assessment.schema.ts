import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredPositiveNumber,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const ASSESSMENT_STATUSES = ['draft', 'in_review', 'published'] as const;

export const createAssessmentSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Assessment name'),
  typeId: requiredId('Type'),
  seriesId: z.string().optional(),
  sessionId: z.string().optional(),
  totalMarks: requiredPositiveNumber('Total marks'),
  conductedAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
  answerKey: optionalString(50000),
  reviewNotes: optionalString(5000),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = createAssessmentSchema.partial();

export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const listAssessmentsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    typeId: z.string().optional(),
    status: z.enum(ASSESSMENT_STATUSES).optional(),
    publishedOnly: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;

export const reportCardsQuerySchema = z.object({
  studentId: z.string().min(1),
  assessmentId: z.string().optional(),
});

export type ReportCardsQuery = z.infer<typeof reportCardsQuerySchema>;

export const marksSheetQuerySchema = z.object({
  batchId: z.string().min(1),
});

export type MarksSheetQuery = z.infer<typeof marksSheetQuerySchema>;

export const bulkMarksSchema = z.object({
  batchId: requiredId('Batch'),
  records: z
    .array(
      z.object({
        studentId: requiredId('Student'),
        subjectId: requiredId('Subject'),
        obtainedMarks: z.coerce.number().min(0),
        remarks: optionalString(500),
      }),
    )
    .min(1),
});

export type BulkMarksInput = z.infer<typeof bulkMarksSchema>;

export const createAssessmentTypeSchema = z.object({
  name: requiredString('Name', 2, 100),
  code: requiredString('Code', 1, 50),
});

export const updateAssessmentTypeSchema = createAssessmentTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAssessmentTypeInput = z.infer<typeof createAssessmentTypeSchema>;
export type UpdateAssessmentTypeInput = z.infer<typeof updateAssessmentTypeSchema>;

export const createAssessmentSeriesSchema = z.object({
  name: requiredString('Name', 2, 100),
  code: requiredString('Code', 1, 50),
});

export const updateAssessmentSeriesSchema = createAssessmentSeriesSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAssessmentSeriesInput = z.infer<typeof createAssessmentSeriesSchema>;
export type UpdateAssessmentSeriesInput = z.infer<typeof updateAssessmentSeriesSchema>;

export const listAssessmentTypesQuerySchema = z
  .object({
    all: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListAssessmentTypesQuery = z.infer<typeof listAssessmentTypesQuerySchema>;

export const listAssessmentSeriesQuerySchema = paginationQuerySchema;

export type ListAssessmentSeriesQuery = z.infer<typeof listAssessmentSeriesQuerySchema>;
