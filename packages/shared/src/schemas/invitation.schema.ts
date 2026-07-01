import { z } from 'zod';

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(2).max(200),
  password: z.string().min(8).max(128),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
