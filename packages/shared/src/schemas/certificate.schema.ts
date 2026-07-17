import { z } from 'zod';

export const certificateTemplateTypes = [
  'completion_certificate',
  'transfer_certificate',
  'character_certificate',
  'id_card',
] as const;

export const listTemplatesQuerySchema = z.object({
  branchId: z.string().optional(),
  type: z.enum(certificateTemplateTypes).optional(),
});

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

export const issueCertificateSchema = z.object({
  branchId: z.string().min(1),
  studentId: z.string().min(1),
  templateId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  serialNo: z.string().max(100).optional().nullable(),
  meta: z.record(z.unknown()).optional(),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

export const listIssuesQuerySchema = z.object({
  branchId: z.string().optional(),
  studentId: z.string().optional(),
  templateId: z.string().optional(),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
