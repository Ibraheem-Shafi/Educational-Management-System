import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const biometricEntityTypes = ['student', 'user'] as const;
export const biometricVendors = ['generic', 'zkteco', 'hikvision', 'suprema'] as const;

export const listBiometricDevicesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListBiometricDevicesQuery = z.infer<typeof listBiometricDevicesQuerySchema>;

export const createBiometricDeviceSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Name', 1, 200),
  vendor: z.enum(biometricVendors, { errorMap: () => ({ message: MSG.select('vendor') }) }).optional(),
  deviceCode: requiredString('Device code', 1, 100),
  location: optionalString(200).nullable(),
  isActive: z.boolean().optional(),
});

export type CreateBiometricDeviceInput = z.infer<typeof createBiometricDeviceSchema>;

export const updateBiometricDeviceSchema = createBiometricDeviceSchema
  .omit({ branchId: true })
  .partial();

export type UpdateBiometricDeviceInput = z.infer<typeof updateBiometricDeviceSchema>;

export const listBiometricMappingsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    deviceId: z.string().optional(),
    entityType: z.enum(biometricEntityTypes).optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListBiometricMappingsQuery = z.infer<typeof listBiometricMappingsQuerySchema>;

export const createBiometricMappingSchema = z.object({
  branchId: requiredId('Branch'),
  externalPersonId: requiredString('External person ID', 1, 100),
  entityType: z.enum(biometricEntityTypes, { errorMap: () => ({ message: MSG.select('entity type') }) }),
  entityId: requiredId('Entity'),
  deviceId: z.string().optional().nullable(),
});

export type CreateBiometricMappingInput = z.infer<typeof createBiometricMappingSchema>;

export const updateBiometricMappingSchema = createBiometricMappingSchema
  .omit({ branchId: true })
  .partial();

export type UpdateBiometricMappingInput = z.infer<typeof updateBiometricMappingSchema>;

export const listBiometricPunchLogsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    deviceId: z.string().optional(),
    externalPersonId: z.string().optional(),
    matched: z.coerce.boolean().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .merge(paginationQuerySchema);

export type ListBiometricPunchLogsQuery = z.infer<typeof listBiometricPunchLogsQuerySchema>;

export const biometricPunchWebhookSchema = z.object({
  deviceCode: requiredString('Device code', 1, 100),
  externalPersonId: requiredString('External person ID', 1, 100),
  punchedAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
  statusCode: optionalString(50),
});

export type BiometricPunchWebhookInput = z.infer<typeof biometricPunchWebhookSchema>;
