import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizePakistanPhone } from '@eims/shared';

export type SmsSendResult = {
  sent: boolean;
  stub?: boolean;
  reason?: string;
  providerMessageSid?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim() &&
        this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim() &&
        this.config.get<string>('TWILIO_SMS_FROM')?.trim(),
    );
  }

  async send(to: string, body: string, statusCallbackUrl?: string): Promise<SmsSendResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_SMS_FROM');
    const e164 = normalizePakistanPhone(to) || to;

    if (!sid || !token || !from) {
      this.logger.warn(`Twilio not configured — SMS not sent to ${to}`);
      this.logger.log(`SMS body: ${body}`);
      return { sent: true, stub: true, reason: 'sms_not_configured' };
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: e164, From: from, Body: body });
    if (statusCallbackUrl) params.set('StatusCallback', statusCallbackUrl);

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
    if (!response.ok) {
      this.logger.error(`Twilio SMS failed: ${text}`);
      return { sent: false, reason: 'provider_error' };
    }

    let providerMessageSid: string | undefined;
    try {
      providerMessageSid = (JSON.parse(text) as { sid?: string }).sid;
    } catch {
      providerMessageSid = undefined;
    }
    return { sent: true, providerMessageSid };
  }
}
