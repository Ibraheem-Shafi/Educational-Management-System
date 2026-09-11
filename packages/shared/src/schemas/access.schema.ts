import { z } from 'zod';
import { ACCESS_MODULES } from '../constants/access-modules';
import { MSG, requiredId, requiredString } from '../validation/messages';

const moduleIds = ACCESS_MODULES.map((module) => module.id) as [string, ...string[]];

export const accessModuleFlagSchema = z.object({
  moduleId: z.enum(moduleIds, { errorMap: () => ({ message: MSG.select('module') }) }),
  view: z.boolean(),
  edit: z.boolean(),
});

export type AccessModuleFlagInput = z.infer<typeof accessModuleFlagSchema>;

export const updateRoleAccessSchema = z.object({
  name: requiredString('Name', 1, 80).optional(),
  description: z.string().max(500).nullable().optional(),
  modules: z.array(accessModuleFlagSchema).min(1),
});

export type UpdateRoleAccessInput = z.infer<typeof updateRoleAccessSchema>;

export const createRoleAccessSchema = z.object({
  name: requiredString('Name', 2, 80),
  description: z.string().max(500).optional(),
  copyFromRoleId: z.string().optional(),
  modules: z.array(accessModuleFlagSchema).optional(),
});

export type CreateRoleAccessInput = z.infer<typeof createRoleAccessSchema>;

export const updateUserRoleSchema = z.object({
  roleId: requiredId('Role'),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserAccessSchema = z.object({
  modules: z.array(accessModuleFlagSchema).min(1),
});

export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;
