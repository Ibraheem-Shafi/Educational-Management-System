import { z } from 'zod';

export const formFieldTypes = ['text', 'number', 'date', 'dropdown', 'checkbox', 'file'] as const;

export const createFormFieldSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(200),
  fieldType: z.enum(formFieldTypes),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>;

export const updateFormFieldSchema = createFormFieldSchema.partial().omit({ code: true }).extend({
  isActive: z.boolean().optional(),
});

export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>;
