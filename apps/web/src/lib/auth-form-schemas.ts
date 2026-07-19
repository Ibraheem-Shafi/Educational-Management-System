import { z } from 'zod';
import { MSG, requiredString } from '@eims/shared';

export const loginFormSchema = z.object({
  email: z.string({ required_error: MSG.required('Email') }).email(MSG.email),
  password: requiredString('Password', 1, 128),
});

export const forgotPasswordFormSchema = z.object({
  email: z.string({ required_error: MSG.required('Email') }).email(MSG.email),
});

export const totpCodeSchema = z.object({
  code: z
    .string({ required_error: 'Enter your 6-digit code' })
    .regex(/^\d{6}$/, 'Enter a valid 6-digit code'),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;
export type ForgotPasswordFormInput = z.infer<typeof forgotPasswordFormSchema>;
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;
