import { z } from 'zod';

export const documentCategories = [
  'admission_form',
  'b_form',
  'cnic',
  'fee_receipt',
  'academic_record',
  'other',
] as const;

export const createDocumentSchema = z.object({
  branchId: z.string().min(1),
  studentId: z.string().min(1),
  category: z.enum(documentCategories),
  title: z.string().min(1).max(200),
  storagePath: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const listDocumentsQuerySchema = z.object({
  studentId: z.string().optional(),
  category: z.enum(documentCategories).optional(),
  branchId: z.string().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
