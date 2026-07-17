import { z } from 'zod';

export const LEARNING_RESOURCE_TYPES = [
  'note',
  'material',
  'syllabus',
  'resource',
  'homework',
  'online_class',
] as const;

export const LEARNING_MEETING_PLATFORMS = ['zoom', 'meet', 'teams', 'other'] as const;

export const LEARNING_VISIBILITY_SCOPES = [
  'branch',
  'program',
  'batch',
  'batch_subject',
] as const;

export const LEARNING_AUDIENCES = ['students', 'parents', 'all'] as const;

export const learningAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export type LearningAttachmentInput = z.infer<typeof learningAttachmentSchema>;

const learningResourceBaseSchema = z.object({
  branchId: z.string().min(1),
  type: z.enum(LEARNING_RESOURCE_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  body: z.string().max(50000).optional(),
  programId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  visibilityScope: z.enum(LEARNING_VISIBILITY_SCOPES),
  audience: z.enum(LEARNING_AUDIENCES).default('all'),
  dueAt: z.string().datetime().optional().nullable(),
  maxMarks: z.number().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  meetingUrl: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .nullable(),
  meetingPlatform: z.enum(LEARNING_MEETING_PLATFORMS).optional().nullable(),
  isPublished: z.boolean().optional().default(false),
  attachments: z.array(learningAttachmentSchema).optional().default([]),
});

function refineLearningScope(
  data: {
    visibilityScope: (typeof LEARNING_VISIBILITY_SCOPES)[number];
    programId?: string | null;
    batchId?: string | null;
    subjectId?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.visibilityScope === 'program' && !data.programId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'programId is required for program scope',
      path: ['programId'],
    });
  }
  if ((data.visibilityScope === 'batch' || data.visibilityScope === 'batch_subject') && !data.batchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'batchId is required for batch scope',
      path: ['batchId'],
    });
  }
  if (data.visibilityScope === 'batch_subject' && !data.subjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'subjectId is required for batch_subject scope',
      path: ['subjectId'],
    });
  }
}

function refineOnlineClass(
  data: {
    type: (typeof LEARNING_RESOURCE_TYPES)[number];
    startsAt?: string | null;
    meetingUrl?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.type !== 'online_class') return;
  if (!data.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startsAt is required for online classes',
      path: ['startsAt'],
    });
  }
  if (!data.meetingUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'meetingUrl is required for online classes',
      path: ['meetingUrl'],
    });
  }
}

export const createLearningResourceSchema = learningResourceBaseSchema
  .superRefine(refineLearningScope)
  .superRefine(refineOnlineClass);

export type CreateLearningResourceInput = z.infer<typeof createLearningResourceSchema>;

export const updateLearningResourceSchema = learningResourceBaseSchema
  .omit({ branchId: true, attachments: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.visibilityScope) {
      refineLearningScope(
        {
          visibilityScope: data.visibilityScope,
          programId: data.programId,
          batchId: data.batchId,
          subjectId: data.subjectId,
        },
        ctx,
      );
    }
    if (data.type === 'online_class') {
      refineOnlineClass(
        {
          type: 'online_class',
          startsAt: data.startsAt,
          meetingUrl: data.meetingUrl,
        },
        ctx,
      );
    }
  });

export type UpdateLearningResourceInput = z.infer<typeof updateLearningResourceSchema>;

export const listLearningQuerySchema = z.object({
  branchId: z.string().optional(),
  type: z.enum(LEARNING_RESOURCE_TYPES).optional(),
  batchId: z.string().optional(),
  subjectId: z.string().optional(),
  programId: z.string().optional(),
  audience: z.enum(LEARNING_AUDIENCES).optional(),
  publishedOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListLearningQuery = z.infer<typeof listLearningQuerySchema>;

export const addLearningAttachmentSchema = learningAttachmentSchema;

export type AddLearningAttachmentInput = z.infer<typeof addLearningAttachmentSchema>;
