import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const programBatchInputSchema = z.object({
  id: requiredId('Batch').optional(),
  name: requiredString('Batch name'),
  subjectIds: z.array(requiredId('Subject')).optional(),
});

export type ProgramBatchInput = z.infer<typeof programBatchInputSchema>;

export const createProgramSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Program name'),
  code: requiredString('Code', 1, 50).optional(),
  description: optionalString(1000),
  batches: z.array(programBatchInputSchema).optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema
  .omit({ branchId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const listProgramsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;

export const createBatchSchema = z.object({
  branchId: requiredId('Branch'),
  programId: requiredId('Program'),
  name: requiredString('Batch name'),
  code: optionalString(50),
  sessionId: z.string().optional(),
  scheduleType: z.enum(['morning', 'evening', 'weekend', 'other'], {
    errorMap: () => ({ message: MSG.select('schedule type') }),
  }).optional(),
  subjectIds: z.array(requiredId('Subject')).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = createBatchSchema
  .omit({ branchId: true, programId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

export const listBatchesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    programId: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;

export const createSubjectSchema = z.object({
  name: requiredString('Subject name'),
  code: requiredString('Code', 1, 50).optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

export const listSubjectsQuerySchema = z
  .object({
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;

const academicSessionFieldsSchema = z.object({
  name: requiredString('Session name', 2, 100),
  startDate: z.string().datetime({ message: MSG.invalidDate }),
  endDate: z.string().datetime({ message: MSG.invalidDate }),
  isCurrent: z.boolean().optional(),
});

export const createAcademicSessionSchema = refineEndAfterStart(
  academicSessionFieldsSchema,
  'startDate',
  'endDate',
);

export type CreateAcademicSessionInput = z.infer<typeof createAcademicSessionSchema>;

export const updateAcademicSessionSchema = refineEndAfterStart(
  academicSessionFieldsSchema.partial(),
  'startDate',
  'endDate',
);

export type UpdateAcademicSessionInput = z.infer<typeof updateAcademicSessionSchema>;

export const listAcademicSessionsQuerySchema = z
  .object({
    search: z.string().optional(),
    isCurrent: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListAcademicSessionsQuery = z.infer<typeof listAcademicSessionsQuerySchema>;

export const setBatchSubjectsSchema = z.object({
  subjectIds: z.array(requiredId('Subject')),
});

export type SetBatchSubjectsInput = z.infer<typeof setBatchSubjectsSchema>;

export const setStudentSubjectsSchema = z.object({
  subjectIds: z.array(requiredId('Subject')),
});

export type SetStudentSubjectsInput = z.infer<typeof setStudentSubjectsSchema>;
