import { z } from 'zod';
import {
  MSG,
  optionalCnic,
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const createParentSchema = z.object({
  fullName: requiredString('Full name'),
  phone: optionalPhone(),
  email: optionalEmail(),
  address: optionalString(500),
  cnic: optionalCnic(),
  studentId: z.string().optional(),
  relationshipCode: z.enum(['father', 'mother', 'guardian']).optional(),
});

export type CreateParentInput = z.infer<typeof createParentSchema>;

export const linkParentStudentSchema = z.object({
  studentId: requiredId('Student'),
  relationshipCode: z.enum(['father', 'mother', 'guardian'], {
    errorMap: () => ({ message: MSG.select('relationship') }),
  }),
});

export type LinkParentStudentInput = z.infer<typeof linkParentStudentSchema>;

export const listParentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  search: z.string().optional(),
});

export type ListParentsQuery = z.infer<typeof listParentsQuerySchema>;

export const listParentStudentsQuerySchema = paginationQuerySchema;

export type ListParentStudentsQuery = z.infer<typeof listParentStudentsQuerySchema>;

export const listStudentParentsQuerySchema = paginationQuerySchema;

export type ListStudentParentsQuery = z.infer<typeof listStudentParentsQuerySchema>;
