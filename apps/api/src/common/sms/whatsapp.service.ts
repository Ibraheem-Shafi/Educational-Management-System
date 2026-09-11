import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  normalizePakistanPhone,
  type CommunicationTemplateKey,
} from '@eims/shared';
import { SmsService, type SmsSendResult } from './sms.service';

export type WhatsAppSendResult = {
  sent: boolean;
  stub?: boolean;
  reason?: string;
  providerMessageSid?: string;
  usedBodyFallback?: boolean;
};

export type TemplateVariables = Record<string, string>;

const TEMPLATE_SID_ENV: Record<CommunicationTemplateKey, string> = {
  notice_broadcast: 'TWILIO_WHATSAPP_CONTENT_SID_NOTICE',
  fee_reminder: 'TWILIO_WHATSAPP_CONTENT_SID_FEE',
  absence_alert: 'TWILIO_WHATSAPP_CONTENT_SID_ABSENCE',
  result_alert: 'TWILIO_WHATSAPP_CONTENT_SID_RESULT',
  custom_utility: 'TWILIO_WHATSAPP_CONTENT_SID_CUSTOM',
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('TWILIO_WHATSAPP_FROM')?.trim());
  }

  getContentSid(templateKey: CommunicationTemplateKey): string | undefined {
    const sid = this.config.get<string>(TEMPLATE_SID_ENV[templateKey])?.trim();
    return sid || undefined;
  }

  getStatusCallbackUrl(): string | undefined {
    const explicit = this.config.get<string>('TWILIO_STATUS_CALLBACK_URL')?.trim();
    if (explicit) return explicit;
    const apiUrl = (
      this.config.get<string>('API_URL') ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
    return `${apiUrl}/api/v1/webhooks/twilio/status`;
  }

  toE164(phone: string): string | null {
    const normalized = normalizePakistanPhone(phone);
    if (!normalized) return null;
    const digits = normalized.replace(/[^\d+]/g, '');
    if (digits.startsWith('+') && digits.length >= 11) return digits;
    return null;
  }

  toWhatsAppAddress(phone: string): string | null {
    const e164 = this.toE164(phone);
    if (!e164) return null;
    return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
  }

  renderSmsBody(templateKey: CommunicationTemplateKey, variables: TemplateVariables): string {
    const institution = variables.institution || 'School';
    switch (templateKey) {
      case 'fee_reminder':
        return `Fee reminder: ${variables.student_name ?? 'your child'} has an outstanding balance of PKR ${variables.amount ?? '—'}. Due: ${variables.due_date ?? 'ASAP'}. — ${institution}`;
      case 'absence_alert':
        return `Absence alert: ${variables.student_name ?? 'your child'} was marked absent on ${variables.date ?? 'today'} at ${institution}. Please contact the school if this is unexpected.`;
      case 'notice_broadcast': {
        const title = variables.title ?? 'Notice';
        const body = variables.body ?? '';
        return body ? `${title}\n\n${body}` : title;
      }
      case 'result_alert':
        return `Results published: ${variables.title ?? 'assessment'} for ${variables.student_name ?? 'your child'} is now available in the parent portal. — ${institution}`;
      case 'custom_utility':
      default:
        return variables.body || variables.title || '';
    }
  }

  contentVariables(variables: TemplateVariables): Record<string, string> {
    const ordered = [
      variables.student_name || variables.title || variables.body || '',
      variables.amount || variables.date || variables.title || '',
      variables.due_date || variables.body || variables.institution || '',
      variables.institution || '',
    ];
    const numbered: Record<string, string> = {};
    ordered.forEach((value, index) => {
      numbered[String(index + 1)] = value;
    });
    return { ...numbered, ...variables };
  }

  async sendTemplate(input: {
    to: string;
    templateKey: CommunicationTemplateKey;
    variables: TemplateVariables;
    mediaUrl?: string;
  }): Promise<WhatsAppSendResult> {
    const toWhatsApp = this.toWhatsAppAddress(input.to);
    if (!toWhatsApp) {
      return { sent: false, reason: 'invalid_phone' };
    }

    const whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM')?.trim();
    if (!whatsappFrom) {
      this.logger.warn(`WhatsApp not configured — message not sent to ${input.to}`);
      this.logger.log(`WhatsApp ${input.templateKey}: ${JSON.stringify(input.variables)}`);
      return { sent: true, stub: true, reason: 'whatsapp_not_configured' };
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      return { sent: true, stub: true, reason: 'twilio_not_configured' };
    }

    const from = whatsappFrom.startsWith('whatsapp:')
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;
    const contentSid = this.getContentSid(input.templateKey);
    const params = new URLSearchParams({
      To: toWhatsApp,
      From: from,
    });
    const callbackUrl = this.getStatusCallbackUrl();
    if (callbackUrl) params.set('StatusCallback', callbackUrl);

    if (contentSid) {
      params.set('ContentSid', contentSid);
      params.set('ContentVariables', JSON.stringify(this.contentVariables(input.variables)));
    } else {
      const body = this.renderSmsBody(input.templateKey, input.variables);
      if (!body) return { sent: false, reason: 'empty_body' };
      params.set('Body', body);
    }

    if (input.mediaUrl) params.set('MediaUrl', input.mediaUrl);

    const result = await this.postTwilio(sid, token, params);
    if (result.sent) {
      return { ...result, usedBodyFallback: !contentSid };
    }
    return result;
  }

  async sendSmsFallback(to: string, body: string): Promise<SmsSendResult> {
    const e164 = this.toE164(to) ?? to;
    return this.sms.send(e164, body);
  }

  validateTwilioSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, string>,
  ): boolean {
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    if (!authToken) {
      return this.config.get<string>('NODE_ENV') !== 'production';
    }
    if (!signature) return false;

    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], url);
    const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async postTwilio(
    sid: string,
    token: string,
    params: URLSearchParams,
  ): Promise<WhatsAppSendResult> {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const text = await response.text();
    let parsed: { sid?: string; message?: string } = {};
    try {
      parsed = JSON.parse(text) as { sid?: string; message?: string };
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      this.logger.error(`Twilio WhatsApp failed: ${text}`);
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true, providerMessageSid: parsed.sid };
  }
}
