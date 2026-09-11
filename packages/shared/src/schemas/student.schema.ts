import { z } from 'zod';
import {
  MSG,
  calendarDateSchema,
  optionalCnic,
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';
import { annualChargeModes } from './fee.schema';

export const admissionGuardianSchema = z.object({
  fullName: requiredString('Guardian name'),
  phone: optionalPhone(),
  email: optionalEmail(),
  address: optionalString(500),
  cnic: optionalCnic(),
  relationshipCode: z.enum(['father', 'mother', 'guardian'], {
    errorMap: () => ({ message: MSG.select('relationship') }),
  }),
});

export type AdmissionGuardianInput = z.infer<typeof admissionGuardianSchema>;

export const createStudentSchema = z.object({
  branchId: requiredId('Branch'),
  fullName: requiredString('Full name'),
  dateOfBirth: z.string().datetime({ message: MSG.invalidDate }).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  cnicOrBForm: optionalCnic(),
  phone: optionalPhone(),
  email: optionalEmail(),
  address: optionalString(500),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  statusId: requiredId('Status'),
  admissionNumber: optionalString(50).nullable().optional(),
  rollNumber: optionalString(50).nullable().optional(),
  subjectIds: z.array(z.string()).optional(),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  guardians: z.array(admissionGuardianSchema).max(3).optional(),
  monthlyFeeDiscount: z.coerce.number().min(0).optional(),
  monthlyFeeAmount: z.coerce.number().min(0).nullable().optional(),
  monthlyFeeWaived: z.boolean().optional(),
  annualChargeMode: z.enum(annualChargeModes).optional(),
  annualDeferredUntil: calendarDateSchema.nullable().optional(),
  annualInstallmentCount: z.coerce.number().int().min(1).max(24).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const listStudentsQuerySchema = z
  .object({
    search: z.string().optional(),
    batchId: z.string().optional(),
    statusId: z.string().optional(),
    sortBy: z.enum(['fullName', 'createdAt', 'rollNumber', 'admissionNumber']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .merge(paginationQuerySchema);

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const updateStudentSchema = createStudentSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    photographUrl: z.string().url(MSG.invalidUrl).nullable().optional(),
    customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
