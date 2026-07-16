import { z } from 'zod';
import { CNIC_REGEX } from '../constants/pakistan';

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(2).max(200),
  password: z.string().min(8).max(128),
  gender: z.enum(['male', 'female', 'other']).optional(),
  cnic: z.string().regex(CNIC_REGEX).optional(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
