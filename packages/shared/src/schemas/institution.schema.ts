import { z } from 'zod';

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
  name: z.string().min(2).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  currency: z.string().min(3).max(3).optional(),
  terminology: terminologySchema.partial().optional(),
  featureFlags: featureFlagsSchema.partial().optional(),
});

export type UpdateInstitutionSettingsInput = z.infer<typeof updateInstitutionSettingsSchema>;
