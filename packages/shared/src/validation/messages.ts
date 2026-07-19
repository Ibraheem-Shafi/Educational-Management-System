import { z } from 'zod';
import { CNIC_REGEX, PHONE_REGEX } from '../constants/pakistan';

export const MSG = {
  required: (label: string) => `${label} is required`,
  minLength: (label: string, min: number) => `${label} must be at least ${min} characters`,
  maxLength: (label: string, max: number) => `${label} must be at most ${max} characters`,
  email: 'Enter a valid email address',
  phone: 'Enter a valid phone (e.g. +923001234567)',
  cnic: 'CNIC must be in format XXXXX-XXXXXXX-X',
  select: (label: string) => `Select ${label.toLowerCase()}`,
  positiveNumber: (label: string) => `${label} must be a positive number`,
  invalidDate: 'Enter a valid date',
  invalidUrl: 'Enter a valid URL',
} as const;

/** Required non-empty string ID (branch, status, etc.) */
export function requiredId(label: string) {
  return z.string().min(1, MSG.required(label));
}

/** Required text field with min/max length */
export function requiredString(label: string, min = 2, max = 200) {
  return z
    .string({ required_error: MSG.required(label) })
    .min(min, MSG.minLength(label, min))
    .max(max, MSG.maxLength(label, max));
}

/** Optional text with max length */
export function optionalString(max = 500) {
  return z.string().max(max, MSG.maxLength('Value', max)).optional();
}

/** Optional email — empty string treated as undefined */
export function optionalEmail() {
  return z
    .string()
    .email(MSG.email)
    .optional()
    .or(z.literal('').transform(() => undefined));
}

/** Optional Pakistan phone (+92XXXXXXXXXX) */
export function optionalPhone() {
  return z
    .string()
    .regex(PHONE_REGEX, MSG.phone)
    .optional()
    .or(z.literal('').transform(() => undefined));
}

/** Required Pakistan phone */
export function requiredPhone() {
  return z.string({ required_error: MSG.required('Phone') }).regex(PHONE_REGEX, MSG.phone);
}

/** Optional CNIC / B-Form */
export function optionalCnic() {
  return z
    .string()
    .regex(CNIC_REGEX, MSG.cnic)
    .optional()
    .or(z.literal('').transform(() => undefined));
}

/** Required CNIC */
export function requiredCnic() {
  return z.string({ required_error: MSG.required('CNIC') }).regex(CNIC_REGEX, MSG.cnic);
}

/** Optional positive number from string or number input */
export function optionalPositiveNumber(label: string) {
  return z.coerce.number().positive(MSG.positiveNumber(label)).optional();
}

/** Required positive number */
export function requiredPositiveNumber(label: string) {
  return z.coerce.number({ required_error: MSG.required(label) }).positive(MSG.positiveNumber(label));
}
