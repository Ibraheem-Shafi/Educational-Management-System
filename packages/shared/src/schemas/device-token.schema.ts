import { z } from 'zod';

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export const DEVICE_APP_ROLES = ['parent', 'student'] as const;

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(DEVICE_PLATFORMS).default('android'),
  appRole: z.enum(DEVICE_APP_ROLES),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().min(1),
});

export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
