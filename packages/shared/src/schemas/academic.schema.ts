import { z } from 'zod';

export const programBatchInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2).max(200),
  subjectIds: z.array(z.string().min(1)).optional(),
});

export type ProgramBatchInput = z.infer<typeof programBatchInputSchema>;

export const createProgramSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  batches: z.array(programBatchInputSchema).optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema
  .omit({ branchId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const listProgramsQuerySchema = z.object({
  branchId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;

export const createBatchSchema = z.object({
  branchId: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(2).max(200),
  code: z.string().max(50).optional(),
  sessionId: z.string().optional(),
  scheduleType: z.enum(['morning', 'evening', 'weekend', 'other']).optional(),
  subjectIds: z.array(z.string().min(1)).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = createBatchSchema
  .omit({ branchId: true, programId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

export const listBatchesQuerySchema = z.object({
  branchId: z.string().optional(),
  programId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(50).optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

export const createAcademicSessionSchema = z.object({
  name: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isCurrent: z.boolean().optional(),
});

export type CreateAcademicSessionInput = z.infer<typeof createAcademicSessionSchema>;

export const updateAcademicSessionSchema = createAcademicSessionSchema.partial();

export type UpdateAcademicSessionInput = z.infer<typeof updateAcademicSessionSchema>;

export const setBatchSubjectsSchema = z.object({
  subjectIds: z.array(z.string().min(1)),
});

export type SetBatchSubjectsInput = z.infer<typeof setBatchSubjectsSchema>;

export const setStudentSubjectsSchema = z.object({
  subjectIds: z.array(z.string().min(1)),
});

export type SetStudentSubjectsInput = z.infer<typeof setStudentSubjectsSchema>;
