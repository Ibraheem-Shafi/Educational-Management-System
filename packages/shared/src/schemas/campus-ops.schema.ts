import { z } from 'zod';
import { MSG, optionalString, requiredId, requiredString } from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const workOrderStatuses = ['open', 'in_progress', 'done'] as const;
export const safetySeverities = ['low', 'medium', 'high'] as const;
export const complianceControlStatuses = ['open', 'compliant', 'overdue'] as const;

const listBase = z
  .object({
    branchId: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export const createWorkOrderSchema = z.object({
  branchId: requiredId('Branch'),
  location: requiredString('Location', 1, 200),
  issue: requiredString('Issue', 1, 2000),
  status: z.enum(workOrderStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  cost: z.coerce.number().min(0).optional().nullable(),
  vendorBillId: z.string().optional().nullable(),
  reportedAt: requiredId('Reported date'),
  notes: optionalString(2000).nullable(),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export const updateWorkOrderSchema = createWorkOrderSchema.omit({ branchId: true }).partial();
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export const listWorkOrdersQuerySchema = listBase.extend({
  status: z.enum(workOrderStatuses).optional(),
});
export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>;

export const createSafetyIncidentSchema = z.object({
  branchId: requiredId('Branch'),
  incidentDate: requiredId('Incident date'),
  severity: z.enum(safetySeverities, { errorMap: () => ({ message: MSG.select('severity') }) }),
  summary: requiredString('Summary', 1, 2000),
  action: optionalString(2000).nullable(),
});
export type CreateSafetyIncidentInput = z.infer<typeof createSafetyIncidentSchema>;
export const updateSafetyIncidentSchema = createSafetyIncidentSchema.omit({ branchId: true }).partial();
export type UpdateSafetyIncidentInput = z.infer<typeof updateSafetyIncidentSchema>;
export const listSafetyIncidentsQuerySchema = listBase.extend({
  severity: z.enum(safetySeverities).optional(),
});
export type ListSafetyIncidentsQuery = z.infer<typeof listSafetyIncidentsQuerySchema>;

export const createItOutageSchema = z.object({
  branchId: requiredId('Branch'),
  startedAt: requiredId('Started at'),
  endedAt: z.string().optional().nullable(),
  system: requiredString('System', 1, 100),
  summary: requiredString('Summary', 1, 2000),
  resolved: z.preprocess((value) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  }, z.boolean().optional()),
});
export type CreateItOutageInput = z.infer<typeof createItOutageSchema>;
export const updateItOutageSchema = createItOutageSchema.omit({ branchId: true }).partial();
export type UpdateItOutageInput = z.infer<typeof updateItOutageSchema>;
export const listItOutagesQuerySchema = listBase.extend({
  resolved: z.coerce.boolean().optional(),
});
export type ListItOutagesQuery = z.infer<typeof listItOutagesQuerySchema>;

export const createComplianceControlSchema = z.object({
  branchId: requiredId('Branch'),
  title: requiredString('Title', 1, 200),
  category: requiredString('Category', 1, 100),
  dueDate: z.string().optional().nullable(),
  status: z
    .enum(complianceControlStatuses, { errorMap: () => ({ message: MSG.select('status') }) })
    .optional(),
  evidenceDocumentId: z.string().optional().nullable(),
  notes: optionalString(2000).nullable(),
});
export type CreateComplianceControlInput = z.infer<typeof createComplianceControlSchema>;
export const updateComplianceControlSchema = createComplianceControlSchema.omit({ branchId: true }).partial();
export type UpdateComplianceControlInput = z.infer<typeof updateComplianceControlSchema>;
export const listComplianceControlsQuerySchema = listBase.extend({
  status: z.enum(complianceControlStatuses).optional(),
  category: z.string().optional(),
});
export type ListComplianceControlsQuery = z.infer<typeof listComplianceControlsQuerySchema>;
