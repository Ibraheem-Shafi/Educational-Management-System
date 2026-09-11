import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredPhone,
  requiredString,
} from '../validation/messages';

export const COMMUNICATION_CHANNELS = ['sms', 'whatsapp'] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_TEMPLATE_KEYS = [
  'notice_broadcast',
  'fee_reminder',
  'absence_alert',
  'result_alert',
  'custom_utility',
] as const;
export type CommunicationTemplateKey = (typeof COMMUNICATION_TEMPLATE_KEYS)[number];

export const COMMUNICATION_AUDIENCES = [
  'parents',
  'students',
  'staff',
  'fee_defaulters',
] as const;
export type CommunicationAudience = (typeof COMMUNICATION_AUDIENCES)[number];

export const COMMUNICATION_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'fallback_sms',
] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const listCommunicationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  channel: z.enum(COMMUNICATION_CHANNELS).optional(),
  status: z.enum(COMMUNICATION_STATUSES).optional(),
  search: z.string().optional(),
});

export type ListCommunicationLogsQuery = z.infer<typeof listCommunicationLogsQuerySchema>;

export const sendMessageSchema = z.object({
  channel: z.enum(COMMUNICATION_CHANNELS, { errorMap: () => ({ message: MSG.select('channel') }) }),
  recipient: requiredPhone(),
  body: requiredString('Message', 1, 1600),
  subject: optionalString(200),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const feeReminderSchema = z.object({
  branchId: z.string().optional(),
  channel: z.enum(COMMUNICATION_CHANNELS, { errorMap: () => ({ message: MSG.select('channel') }) }).default('whatsapp'),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  smsFallback: z.boolean().optional().default(false),
});

export type FeeReminderInput = z.input<typeof feeReminderSchema>;

export const absenceAlertSchema = z.object({
  branchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.invalidDate),
  studentIds: z.array(requiredId('Student')).min(1),
  channel: z.enum(COMMUNICATION_CHANNELS, { errorMap: () => ({ message: MSG.select('channel') }) }).default('whatsapp'),
  smsFallback: z.boolean().optional().default(false),
});

export type AbsenceAlertInput = z.input<typeof absenceAlertSchema>;

export const noticeBroadcastSchema = z.object({
  noticeId: requiredId('Notice'),
  channel: z.enum(COMMUNICATION_CHANNELS, { errorMap: () => ({ message: MSG.select('channel') }) }).default('whatsapp'),
  audience: z.enum(['parents', 'students', 'staff', 'all'], {
    errorMap: () => ({ message: MSG.select('audience') }),
  }).default('parents'),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  smsFallback: z.boolean().optional().default(false),
});

export type NoticeBroadcastInput = z.input<typeof noticeBroadcastSchema>;

const audienceFiltersSchema = z.object({
  audience: z.enum(COMMUNICATION_AUDIENCES, { errorMap: () => ({ message: MSG.select('audience') }) }),
  programId: z.string().optional(),
  batchId: z.string().optional(),
});

export const previewAudienceSchema = audienceFiltersSchema;

export type PreviewAudienceInput = z.infer<typeof previewAudienceSchema>;

export const broadcastCampaignSchema = audienceFiltersSchema.extend({
  channel: z.enum(COMMUNICATION_CHANNELS, { errorMap: () => ({ message: MSG.select('channel') }) }).default('whatsapp'),
  noticeId: z.string().optional(),
  customBody: optionalString(1600),
  smsFallback: z.boolean().optional().default(true),
}).superRefine((value, ctx) => {
  if (value.audience === 'fee_defaulters') return;
  if (!value.noticeId && !value.customBody?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customBody'],
      message: 'Select a notice or enter a message',
    });
  }
});

export type BroadcastCampaignInput = z.input<typeof broadcastCampaignSchema>;
