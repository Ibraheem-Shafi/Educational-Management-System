import { z } from 'zod';
import {
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const certificateTemplateTypes = [
  'completion_certificate',
  'transfer_certificate',
  'character_certificate',
  'id_card',
] as const;

export const listTemplatesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    type: z.enum(certificateTemplateTypes).optional(),
  })
  .merge(paginationQuerySchema);

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

export const issueCertificateSchema = z.object({
  branchId: requiredId('Branch'),
  studentId: requiredId('Student'),
  templateId: requiredId('Template'),
  title: requiredString('Title', 1, 200).optional(),
  serialNo: optionalString(100).nullable(),
  meta: z.record(z.unknown()).optional(),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

export const listIssuesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    studentId: z.string().optional(),
    templateId: z.string().optional(),
    search: z.string().optional(),
    issuedFrom: z.string().optional(),
    issuedTo: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
