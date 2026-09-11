import type { CountWithTrend } from '../common/stats-metric';

export interface CommunicationsStatsResponse {
  sentLast30Days: CountWithTrend;
  failedLast30Days: CountWithTrend;
  smsCount: CountWithTrend;
  whatsappCount: CountWithTrend;
}

export interface CommunicationsProviderConfig {
  whatsappConfigured: boolean;
  smsConfigured: boolean;
  templatesConfigured: {
    notice_broadcast: boolean;
    fee_reminder: boolean;
    absence_alert: boolean;
    result_alert: boolean;
    custom_utility: boolean;
  };
}

export interface CommunicationLog {
  id: string;
  campaignId: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  templateKey: string | null;
  providerMessageSid: string | null;
  errorCode: string | null;
  createdAt: string;
  campaign?: {
    id: string;
    templateKey: string;
    audience: string;
  } | null;
}

export interface CommunicationCampaignQueuedResponse {
  campaignId: string;
  queued: number;
  sent: number;
}
