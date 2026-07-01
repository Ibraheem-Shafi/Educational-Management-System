import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormFieldsService } from './form-fields.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createFormFieldSchema, updateFormFieldSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateFormFieldInput, UpdateFormFieldInput } from '@eims/shared';

@ApiTags('form-fields')
@ApiBearerAuth()
@Controller('form-fields')
@UseGuards(AuthGuard, PermissionsGuard)
export class FormFieldsController {
  constructor(private readonly formFieldsService: FormFieldsService) {}

  @Get()
  @Permissions('students.read')
  findAll(@Query('all') all?: string) {
    return this.formFieldsService.findAll(all !== 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('form_fields.manage')
  create(
    @Body(createZodPipe(createFormFieldSchema)) body: CreateFormFieldInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formFieldsService.create(body, user);
  }

  @Patch(':id')
  @Permissions('form_fields.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateFormFieldSchema)) body: UpdateFormFieldInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formFieldsService.update(id, body, user);
  }

  @Delete(':id')
  @Permissions('form_fields.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.formFieldsService.remove(id, user);
  }
}
