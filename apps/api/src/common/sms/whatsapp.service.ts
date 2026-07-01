import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  async send(to: string, body: string) {
    const whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM');

    if (!whatsappFrom) {
      this.logger.warn(`WhatsApp not configured — message not sent to ${to}`);
      this.logger.log(`WhatsApp body: ${body}`);
      return { sent: false, reason: 'whatsapp_not_configured' };
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      return this.sms.send(to, body);
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const params = new URLSearchParams({
      To: toWhatsApp,
      From: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
      Body: body,
    });

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
      this.logger.error(`Twilio WhatsApp failed: ${text}`);
      return { sent: false, reason: 'provider_error' };
    }

    return { sent: true };
  }
}
