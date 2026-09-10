import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { CommunicationsService } from './communications.service';
import { TwilioWebhookGuard } from './twilio-webhook.guard';

@ApiTags('webhooks')
@Controller('webhooks/twilio')
export class TwilioWebhookController {
  constructor(private readonly communications: CommunicationsService) {}

  @Public()
  @Post('status')
  @UseGuards(TwilioWebhookGuard)
  @HttpCode(HttpStatus.OK)
  status(@Body() body: Record<string, string>) {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(body ?? {})) {
      params[key] = value == null ? '' : String(value);
    }
    return this.communications.handleTwilioStatus(params);
  }
}
