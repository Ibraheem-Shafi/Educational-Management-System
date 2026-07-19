import { z } from 'zod';
import {
  MSG,
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredString,
} from '../validation/messages';

export const terminologySchema = z.object({
  batch: z.string(),
  program: z.string(),
  assessment: z.string(),
  session: z.string(),
});

export const featureFlagsSchema = z.object({
  timetable: z.boolean(),
  formBuilder: z.boolean(),
  aiAttendance: z.boolean(),
  parentPortal: z.boolean(),
  studentPortal: z.boolean(),
  rankings: z.boolean(),
  assessmentSeries: z.boolean(),
});

export const updateInstitutionSettingsSchema = z.object({
  name: requiredString('Institution name').optional(),
  logoUrl: z.string().url(MSG.invalidUrl).nullable().optional(),
  faviconUrl: z.string().url(MSG.invalidUrl).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color (e.g. #1a2b3c)').optional(),
  address: optionalString(500).nullable(),
  city: optionalString(100).nullable(),
  province: optionalString(100).nullable(),
  phone: optionalPhone().nullable(),
  email: optionalEmail().nullable(),
  website: z.string().url(MSG.invalidUrl).nullable().optional(),
  timezone: requiredString('Timezone', 1, 64).optional(),
  currency: requiredString('Currency', 3, 3).optional(),
  terminology: terminologySchema.partial().optional(),
  featureFlags: featureFlagsSchema.partial().optional(),
});

export type UpdateInstitutionSettingsInput = z.infer<typeof updateInstitutionSettingsSchema>;
