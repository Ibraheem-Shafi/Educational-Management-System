import { z } from 'zod';

export const documentCategories = [
  'admission_form',
  'b_form',
  'cnic',
  'fee_receipt',
  'academic_record',
  'employee_contract',
  'employee_id',
  'employee_other',
  'other',
] as const;

export const createDocumentSchema = z
  .object({
    branchId: z.string().min(1),
    studentId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    category: z.enum(documentCategories),
    title: z.string().min(1).max(200),
    storagePath: z.string().min(1),
    mimeType: z.string().optional(),
    sizeBytes: z.number().int().positive().optional(),
  })
  .refine((data) => Boolean(data.studentId) !== Boolean(data.userId), {
    message: 'Exactly one of studentId or userId is required',
  });

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const listDocumentsQuerySchema = z.object({
  studentId: z.string().optional(),
  userId: z.string().optional(),
  category: z.enum(documentCategories).optional(),
  branchId: z.string().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
