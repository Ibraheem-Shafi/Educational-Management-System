import { Injectable, Logger } from '@nestjs/common';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /** Stub — wire to Expo Push API or FCM in a later phase. */
  async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    if (tokens.length === 0) return;
    this.logger.debug(`Push stub: would send "${payload.title}" to ${tokens.length} token(s)`);
  }
}
