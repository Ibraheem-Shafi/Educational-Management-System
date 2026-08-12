import { z } from 'zod';
import {
  MSG,
  requiredId,
  requiredString,
} from '../validation/messages';

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
    branchId: requiredId('Branch'),
    studentId: requiredId('Student').optional(),
    userId: requiredId('User').optional(),
    category: z.enum(documentCategories, { errorMap: () => ({ message: MSG.select('category') }) }),
    title: requiredString('Title', 1, 200),
    storagePath: requiredId('Storage path'),
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
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export const prepareDocumentUploadSchema = z
  .object({
    fileName: requiredString('File name', 1, 255),
    branchId: requiredId('Branch'),
    studentId: requiredId('Student').optional(),
    userId: requiredId('User').optional(),
  })
  .refine((data) => Boolean(data.studentId) !== Boolean(data.userId), {
    message: 'Exactly one of studentId or userId is required',
  });

export type PrepareDocumentUploadInput = z.infer<typeof prepareDocumentUploadSchema>;

export const prepareStudentPhotoUploadSchema = z.object({
  fileName: requiredString('File name', 1, 255),
});

export type PrepareStudentPhotoUploadInput = z.infer<typeof prepareStudentPhotoUploadSchema>;

export const prepareInstitutionAssetUploadSchema = z.object({
  fileName: requiredString('File name', 1, 255),
  folder: z.enum(['logo', 'favicon']),
});

export type PrepareInstitutionAssetUploadInput = z.infer<
  typeof prepareInstitutionAssetUploadSchema
>;

export const prepareAttendanceRegisterUploadSchema = z.object({
  fileName: requiredString('File name', 1, 255),
  branchId: requiredId('Branch'),
});

export type PrepareAttendanceRegisterUploadInput = z.infer<
  typeof prepareAttendanceRegisterUploadSchema
>;
