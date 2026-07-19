import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, SettingsModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
