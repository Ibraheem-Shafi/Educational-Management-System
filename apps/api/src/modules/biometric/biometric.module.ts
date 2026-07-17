import { Module } from '@nestjs/common';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { BiometricWebhookGuard } from './biometric-webhook.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [BiometricController],
  providers: [BiometricService, BiometricWebhookGuard],
  exports: [BiometricService],
})
export class BiometricModule {}
