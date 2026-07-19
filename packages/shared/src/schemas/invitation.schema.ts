import { z } from 'zod';
import {
  optionalCnic,
  requiredId,
  requiredString,
} from '../validation/messages';

export const acceptInvitationSchema = z.object({
  token: requiredId('Token'),
  fullName: requiredString('Full name'),
  password: requiredString('Password', 8, 128),
  gender: z.enum(['male', 'female', 'other']).optional(),
  cnic: optionalCnic(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
