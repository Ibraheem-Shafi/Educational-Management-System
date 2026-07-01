import { Module } from '@nestjs/common';
import { ParentsController, StudentParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ParentsController, StudentParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
