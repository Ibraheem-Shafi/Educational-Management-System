import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createOcrSessionSchema = z.object({
  branchId: z.string().min(1),
  batchId: z.string().min(1),
  date: dateOnlySchema,
  imagePath: z.string().min(1),
});

export type CreateOcrSessionInput = z.infer<typeof createOcrSessionSchema>;

export const analyzeOcrSessionSchema = z.object({
  rawText: z.string().min(1).optional(),
});

export type AnalyzeOcrSessionInput = z.infer<typeof analyzeOcrSessionSchema>;

export const confirmOcrSessionSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        statusId: z.string().min(1),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export type ConfirmOcrSessionInput = z.infer<typeof confirmOcrSessionSchema>;
