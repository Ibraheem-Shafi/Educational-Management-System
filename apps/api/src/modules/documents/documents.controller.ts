import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createDocumentSchema, listDocumentsQuerySchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateDocumentInput, ListDocumentsQuery } from '@eims/shared';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Permissions('documents.read')
  findAll(
    @Query(createZodPipe(listDocumentsQuerySchema)) query: ListDocumentsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.documentsService.findAll(query, branchId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('documents.upload')
  create(
    @Body(createZodPipe(createDocumentSchema)) body: CreateDocumentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.create(body, user);
  }

  @Get(':id/signed-url')
  @Permissions('documents.read')
  signedUrl(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.documentsService.getSignedUrl(id, branchId);
  }

  @Delete(':id')
  @Permissions('documents.upload')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.documentsService.remove(id, user, branchId);
  }
}
