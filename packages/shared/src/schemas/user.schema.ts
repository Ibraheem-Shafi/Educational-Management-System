import { z } from 'zod';
import { CNIC_REGEX } from '../constants/pakistan';

const genderSchema = z.enum(['male', 'female', 'other']);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  branchId: z.string().optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  search: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createInvitationSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
  branchId: z.string().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  gender: genderSchema.optional(),
  cnic: z.string().regex(CNIC_REGEX).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  gender: genderSchema.optional(),
  cnic: z.string().regex(CNIC_REGEX).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  designation: z.string().max(200).nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
