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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
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
  getStats(@BranchId() branchId: string | null) {
    return this.noticesService.getStats(branchId);
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(createZodPipe(listNoticesQuerySchema)) query: ListNoticesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.noticesService.findAll(query, branchId);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.noticesService.findOne(id, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.noticesService.update(id, body, user, branchId);
  }

  @Delete(':id')
  @Permissions('students.update')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.noticesService.remove(id, user, branchId);
  }
}
