import { z } from 'zod';
import {
  MSG,
  optionalCnic,
  optionalPhone,
  requiredId,
  requiredString,
} from '../validation/messages';

const genderSchema = z.enum(['male', 'female', 'other'], {
  errorMap: () => ({ message: MSG.select('gender') }),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  branchId: z.string().optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  search: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createInvitationSchema = z.object({
  email: z.string({ required_error: MSG.required('Email') }).email(MSG.email),
  roleId: requiredId('Role'),
  branchId: z.string().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateProfileSchema = z.object({
  fullName: requiredString('Full name').optional(),
  phone: optionalPhone().nullable(),
  gender: genderSchema.optional(),
  cnic: optionalCnic().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  fullName: requiredString('Full name').optional(),
  phone: optionalPhone().nullable(),
  gender: genderSchema.optional(),
  cnic: optionalCnic().nullable(),
  department: requiredString('Department', 1, 200).nullable().optional(),
  designation: requiredString('Designation', 1, 200).nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
