import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  listPrintTemplatesQuerySchema,
  printDocumentTypes,
  updatePrintTemplateSchema,
  type ListPrintTemplatesQuery,
  type PrintDocumentType,
  type UpdatePrintTemplateInput,
} from '@eims/shared';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { PrintTemplatesService } from './print-templates.service';
import type { AuthUser } from '@eims/types';
import { BadRequestException } from '@nestjs/common';

@ApiTags('print-templates')
@ApiBearerAuth()
@Controller('print-templates')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class PrintTemplatesController {
  constructor(private readonly printTemplatesService: PrintTemplatesService) {}

  @Get()
  @Permissions('settings.manage')
  findAll(@Query(createZodPipe(listPrintTemplatesQuerySchema)) query: ListPrintTemplatesQuery) {
    return this.printTemplatesService.findAll(query);
  }

  @Get(':type')
  @Permissions('settings.manage')
  findByType(@Param('type') type: string, @Query('branchId') branchId?: string) {
    if (!(printDocumentTypes as readonly string[]).includes(type)) {
      throw new BadRequestException('Invalid print document type');
    }
    return this.printTemplatesService.findByType(type as PrintDocumentType, branchId);
  }

  @Patch(':id')
  @Permissions('settings.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updatePrintTemplateSchema)) body: UpdatePrintTemplateInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.printTemplatesService.update(id, body, user);
  }
}
