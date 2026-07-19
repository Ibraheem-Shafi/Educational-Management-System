import { z } from 'zod';
import {
  MSG,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const formFieldTypes = ['text', 'number', 'date', 'dropdown', 'checkbox', 'file'] as const;

export const createFormFieldSchema = z.object({
  code: requiredString('Code', 1, 50).regex(/^[a-z][a-z0-9_]*$/, 'Code must start with a letter and contain only lowercase letters, numbers, and underscores'),
  label: requiredString('Label', 1, 200),
  fieldType: z.enum(formFieldTypes, { errorMap: () => ({ message: MSG.select('field type') }) }),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>;

export const updateFormFieldSchema = createFormFieldSchema.partial().omit({ code: true }).extend({
  isActive: z.boolean().optional(),
});

export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>;

export const listFormFieldsQuerySchema = z
  .object({
    all: z.coerce.boolean().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFormFieldsQuery = z.infer<typeof listFormFieldsQuerySchema>;
