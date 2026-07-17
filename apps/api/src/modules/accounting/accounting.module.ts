import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingPostingService } from './accounting-posting.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingPostingService],
  exports: [AccountingPostingService],
})
export class AccountingModule {}
