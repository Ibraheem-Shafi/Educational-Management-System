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
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createDocumentSchema, listDocumentsQuerySchema, prepareDocumentUploadSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  CreateDocumentInput,
  ListDocumentsQuery,
  PrepareDocumentUploadInput,
} from '@eims/shared';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('stats')
  @Permissions('documents.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.documentsService.getStats(scope);
  }

  @Get()
  @Permissions('documents.read')
  findAll(
    @Query(createZodPipe(listDocumentsQuerySchema)) query: ListDocumentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.documentsService.findAll(query, scope);
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

  @Post('upload-url')
  @Permissions('documents.upload')
  prepareUpload(
    @Body(createZodPipe(prepareDocumentUploadSchema)) body: PrepareDocumentUploadInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.prepareUpload(body, user);
  }

  @Get(':id/signed-url')
  @Permissions('documents.read')
  signedUrl(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.documentsService.getSignedUrl(id, scope);
  }

  @Delete(':id')
  @Permissions('documents.upload')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.documentsService.remove(id, user, scope);
  }
}
