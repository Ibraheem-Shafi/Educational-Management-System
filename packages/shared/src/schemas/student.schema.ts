import { z } from 'zod';
import { CNIC_REGEX, PHONE_REGEX } from '../constants/pakistan';

export const admissionGuardianSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  cnic: z.string().regex(CNIC_REGEX).optional(),
  relationshipCode: z.enum(['father', 'mother', 'guardian']),
});

export type AdmissionGuardianInput = z.infer<typeof admissionGuardianSchema>;

export const createStudentSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  cnicOrBForm: z.string().regex(CNIC_REGEX).optional(),
  phone: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  statusId: z.string().min(1),
  subjectIds: z.array(z.string()).optional(),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  guardians: z.array(admissionGuardianSchema).max(3).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  batchId: z.string().optional(),
  statusId: z.string().optional(),
  sortBy: z.enum(['fullName', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const updateStudentSchema = createStudentSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    photographUrl: z.string().url().nullable().optional(),
    customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
