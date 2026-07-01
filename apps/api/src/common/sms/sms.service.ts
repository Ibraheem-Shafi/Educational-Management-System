import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, body: string) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_SMS_FROM');

    if (!sid || !token || !from) {
      this.logger.warn(`Twilio not configured — SMS not sent to ${to}`);
      this.logger.log(`SMS body: ${body}`);
      return { sent: false, reason: 'sms_not_configured' };
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: body });
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

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Twilio SMS failed: ${text}`);
      return { sent: false, reason: 'provider_error' };
    }

    return { sent: true };
  }
}
