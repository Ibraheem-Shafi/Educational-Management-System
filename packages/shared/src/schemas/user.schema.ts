import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
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
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
