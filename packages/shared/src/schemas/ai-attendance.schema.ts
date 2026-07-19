import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.invalidDate);

export const createOcrSessionSchema = z.object({
  branchId: requiredId('Branch'),
  batchId: requiredId('Batch'),
  date: dateOnlySchema,
  imagePath: requiredId('Image path'),
});

export type CreateOcrSessionInput = z.infer<typeof createOcrSessionSchema>;

export const analyzeOcrSessionSchema = z.object({
  rawText: requiredString('Raw text', 1, 50000).optional(),
});

export type AnalyzeOcrSessionInput = z.infer<typeof analyzeOcrSessionSchema>;

export const confirmOcrSessionSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: requiredId('Student'),
        statusId: requiredId('Status'),
        remarks: optionalString(500),
      }),
    )
    .min(1),
});

export type ConfirmOcrSessionInput = z.infer<typeof confirmOcrSessionSchema>;

export const listOcrSessionsQuerySchema = paginationQuerySchema;

export type ListOcrSessionsQuery = z.infer<typeof listOcrSessionsQuerySchema>;
