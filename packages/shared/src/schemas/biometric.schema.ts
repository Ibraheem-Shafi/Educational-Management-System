import { z } from 'zod';

export const biometricEntityTypes = ['student', 'user'] as const;
export const biometricVendors = ['generic', 'zkteco', 'hikvision', 'suprema'] as const;

export const listBiometricDevicesQuerySchema = z.object({
  branchId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type ListBiometricDevicesQuery = z.infer<typeof listBiometricDevicesQuerySchema>;

export const createBiometricDeviceSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(200),
  vendor: z.enum(biometricVendors).optional(),
  deviceCode: z.string().min(1).max(100),
  location: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateBiometricDeviceInput = z.infer<typeof createBiometricDeviceSchema>;

export const updateBiometricDeviceSchema = createBiometricDeviceSchema
  .omit({ branchId: true })
  .partial();

export type UpdateBiometricDeviceInput = z.infer<typeof updateBiometricDeviceSchema>;

export const listBiometricMappingsQuerySchema = z.object({
  branchId: z.string().optional(),
  deviceId: z.string().optional(),
  entityType: z.enum(biometricEntityTypes).optional(),
  search: z.string().optional(),
});

export type ListBiometricMappingsQuery = z.infer<typeof listBiometricMappingsQuerySchema>;

export const createBiometricMappingSchema = z.object({
  branchId: z.string().min(1),
  externalPersonId: z.string().min(1).max(100),
  entityType: z.enum(biometricEntityTypes),
  entityId: z.string().min(1),
  deviceId: z.string().optional().nullable(),
});

export type CreateBiometricMappingInput = z.infer<typeof createBiometricMappingSchema>;

export const updateBiometricMappingSchema = createBiometricMappingSchema
  .omit({ branchId: true })
  .partial();

export type UpdateBiometricMappingInput = z.infer<typeof updateBiometricMappingSchema>;

export const listBiometricPunchLogsQuerySchema = z.object({
  branchId: z.string().optional(),
  deviceId: z.string().optional(),
  externalPersonId: z.string().optional(),
  matched: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type ListBiometricPunchLogsQuery = z.infer<typeof listBiometricPunchLogsQuerySchema>;

export const biometricPunchWebhookSchema = z.object({
  deviceCode: z.string().min(1).max(100),
  externalPersonId: z.string().min(1).max(100),
  punchedAt: z.string().datetime().optional(),
  statusCode: z.string().max(50).optional(),
});

export type BiometricPunchWebhookInput = z.infer<typeof biometricPunchWebhookSchema>;
