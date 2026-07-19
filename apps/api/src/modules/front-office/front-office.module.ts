import { Module } from '@nestjs/common';
import { FrontOfficeController } from './front-office.controller';
import { FrontOfficeService } from './front-office.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FrontOfficeController],
  providers: [FrontOfficeService],
  exports: [FrontOfficeService],
})
export class FrontOfficeModule {}
