import { Module } from '@nestjs/common';
import { FormFieldsController } from './form-fields.controller';
import { FormFieldsService } from './form-fields.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FormFieldsController],
  providers: [FormFieldsService],
  exports: [FormFieldsService],
})
export class FormFieldsModule {}
