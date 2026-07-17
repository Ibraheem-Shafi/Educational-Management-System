import { z } from 'zod';

export const sendMessageSchema = z.object({
  channel: z.enum(['sms', 'whatsapp']),
  recipient: z.string().min(5),
  body: z.string().min(1).max(1600),
  subject: z.string().max(200).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const feeReminderSchema = z.object({
  branchId: z.string().optional(),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

export type FeeReminderInput = z.infer<typeof feeReminderSchema>;

export const absenceAlertSchema = z.object({
  branchId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studentIds: z.array(z.string().min(1)).min(1),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

export type AbsenceAlertInput = z.infer<typeof absenceAlertSchema>;

export const noticeBroadcastSchema = z.object({
  noticeId: z.string().min(1),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
  audience: z.enum(['parents', 'students', 'all']).default('parents'),
});

export type NoticeBroadcastInput = z.infer<typeof noticeBroadcastSchema>;
