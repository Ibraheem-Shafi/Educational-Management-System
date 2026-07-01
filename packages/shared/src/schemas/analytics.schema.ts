import { z } from 'zod';

export const analyticsTrendsQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type AnalyticsTrendsQuery = z.infer<typeof analyticsTrendsQuerySchema>;

export const analyticsPerformanceQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  assessmentId: z.string().optional(),
});

export type AnalyticsPerformanceQuery = z.infer<typeof analyticsPerformanceQuerySchema>;

export const analyticsWeakSubjectsQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  threshold: z.coerce.number().min(0).max(100).default(50),
});

export type AnalyticsWeakSubjectsQuery = z.infer<typeof analyticsWeakSubjectsQuerySchema>;

export const analyticsCorrelationQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
});

export type AnalyticsCorrelationQuery = z.infer<typeof analyticsCorrelationQuerySchema>;
