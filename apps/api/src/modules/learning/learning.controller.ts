import type { BranchScope } from '@eims/shared';
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
import { LearningService } from './learning.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createLearningResourceSchema,
  updateLearningResourceSchema,
  listLearningQuerySchema,
  addLearningAttachmentSchema,
  prepareLearningAttachmentUploadSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateLearningResourceInput,
  UpdateLearningResourceInput,
  ListLearningQuery,
  AddLearningAttachmentInput,
  PrepareLearningAttachmentUploadInput,
} from '@eims/shared';

@ApiTags('learning')
@ApiBearerAuth()
@Controller('learning')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('stats')
  @Permissions('learning.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.learningService.getStats(scope);
  }

  @Get()
  @Permissions('learning.read')
  findAll(
    @Query(createZodPipe(listLearningQuerySchema)) query: ListLearningQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.findAll(query, scope);
  }

  @Get(':id')
  @Permissions('learning.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.learningService.findOne(id, scope);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('learning.publish')
  create(
    @Body(createZodPipe(createLearningResourceSchema)) body: CreateLearningResourceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.learningService.create(body, user);
  }

  @Patch(':id')
  @Permissions('learning.publish')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateLearningResourceSchema)) body: UpdateLearningResourceInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.update(id, body, user, scope);
  }

  @Delete(':id')
  @Permissions('learning.publish')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.remove(id, user, scope);
  }

  @Post(':id/attachments/upload-url')
  @Permissions('learning.publish')
  prepareAttachmentUpload(
    @Param('id') id: string,
    @Body(createZodPipe(prepareLearningAttachmentUploadSchema))
    body: PrepareLearningAttachmentUploadInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.prepareAttachmentUpload(id, body, user, scope);
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('learning.publish')
  addAttachment(
    @Param('id') id: string,
    @Body(createZodPipe(addLearningAttachmentSchema)) body: AddLearningAttachmentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.addAttachment(id, body, user, scope);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permissions('learning.publish')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.removeAttachment(id, attachmentId, user, scope);
  }

  @Get(':id/attachments/:attachmentId/signed-url')
  @Permissions('learning.read')
  signedUrl(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.learningService.getAttachmentSignedUrl(id, attachmentId, scope);
  }
}
