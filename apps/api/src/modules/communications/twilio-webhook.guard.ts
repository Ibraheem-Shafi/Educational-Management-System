import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../../common/sms/whatsapp.service';

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
      headers: Record<string, string | string[] | undefined>;
      protocol: string;
      originalUrl: string;
      get: (name: string) => string | undefined;
    }>();

    const signatureHeader = request.headers['x-twilio-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.body ?? {})) {
      params[key] = value == null ? '' : String(value);
    }

    const configuredUrl = this.config.get<string>('TWILIO_STATUS_CALLBACK_URL')?.trim();
    const protoHeader = request.headers['x-forwarded-proto'];
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    const hostHeader = request.headers['x-forwarded-host'];
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    const url =
      configuredUrl ||
      `${proto || request.protocol}://${host || request.get('host')}${request.originalUrl}`;

    if (!this.whatsapp.validateTwilioSignature(signature, url, params)) {
      throw new UnauthorizedException('Invalid Twilio signature');
    }
    return true;
  }
}
