import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';

export const listCommunicationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  channel: z.enum(['sms', 'whatsapp']).optional(),
  status: z.enum(['sent', 'failed', 'queued']).optional(),
  search: z.string().optional(),
});

export type ListCommunicationLogsQuery = z.infer<typeof listCommunicationLogsQuerySchema>;

export const sendMessageSchema = z.object({
  channel: z.enum(['sms', 'whatsapp'], { errorMap: () => ({ message: MSG.select('channel') }) }),
  recipient: requiredString('Recipient', 5, 30),
  body: requiredString('Message', 1, 1600),
  subject: optionalString(200),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const feeReminderSchema = z.object({
  branchId: z.string().optional(),
  channel: z.enum(['sms', 'whatsapp'], { errorMap: () => ({ message: MSG.select('channel') }) }).default('sms'),
});

export type FeeReminderInput = z.infer<typeof feeReminderSchema>;

export const absenceAlertSchema = z.object({
  branchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.invalidDate),
  studentIds: z.array(requiredId('Student')).min(1),
  channel: z.enum(['sms', 'whatsapp'], { errorMap: () => ({ message: MSG.select('channel') }) }).default('sms'),
});

export type AbsenceAlertInput = z.infer<typeof absenceAlertSchema>;

export const noticeBroadcastSchema = z.object({
  noticeId: requiredId('Notice'),
  channel: z.enum(['sms', 'whatsapp'], { errorMap: () => ({ message: MSG.select('channel') }) }).default('sms'),
  audience: z.enum(['parents', 'students', 'all'], { errorMap: () => ({ message: MSG.select('audience') }) }).default('parents'),
});

export type NoticeBroadcastInput = z.infer<typeof noticeBroadcastSchema>;
