import { z } from 'zod';
import { CNIC_REGEX, PHONE_REGEX } from '../constants/pakistan';

export const createParentSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  cnic: z.string().regex(CNIC_REGEX).optional(),
  studentId: z.string().optional(),
  relationshipCode: z.enum(['father', 'mother', 'guardian']).optional(),
});

export type CreateParentInput = z.infer<typeof createParentSchema>;

export const linkParentStudentSchema = z.object({
  studentId: z.string().min(1),
  relationshipCode: z.enum(['father', 'mother', 'guardian']),
});

export type LinkParentStudentInput = z.infer<typeof linkParentStudentSchema>;

export const listParentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type ListParentsQuery = z.infer<typeof listParentsQuerySchema>;
