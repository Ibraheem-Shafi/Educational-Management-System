import { z } from 'zod';
import { MSG, requiredString } from '../validation/messages';

export const resolveLoginIdentifierSchema = z.object({
  identifier: requiredString('Email or phone', 3, 200),
});

export type ResolveLoginIdentifierInput = z.infer<typeof resolveLoginIdentifierSchema>;

export const loginIdentifierFormSchema = z.object({
  identifier: z
    .string({ required_error: MSG.required('Email or phone') })
    .min(3, MSG.required('Email or phone')),
  password: requiredString('Password', 1, 128),
});
