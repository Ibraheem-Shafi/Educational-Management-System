import type { BranchScope } from '@eims/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateNoticeInput, UpdateNoticeInput, ListNoticesQuery } from '@eims/shared';

@ApiTags('notices')
@ApiBearerAuth()
@Controller('notices')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get('stats')
  @Permissions('students.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.noticesService.getStats(scope);
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(createZodPipe(listNoticesQuerySchema)) query: ListNoticesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.noticesService.findAll(query, scope);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.noticesService.findOne(id, scope);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('students.update')
  create(
    @Body(createZodPipe(createNoticeSchema)) body: CreateNoticeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.noticesService.create(body, user);
  }

  @Patch(':id')
  @Permissions('students.update')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateNoticeSchema)) body: UpdateNoticeInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.noticesService.update(id, body, user, scope);
  }

  @Delete(':id')
  @Permissions('students.update')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.noticesService.remove(id, user, scope);
  }
}
