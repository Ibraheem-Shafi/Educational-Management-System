import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiAttendanceService } from './ai-attendance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  analyzeOcrSessionSchema,
  confirmOcrSessionSchema,
  createOcrSessionSchema,
  listOcrSessionsQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AnalyzeOcrSessionInput,
  BranchScope,
  ConfirmOcrSessionInput,
  CreateOcrSessionInput,
  ListOcrSessionsQuery,
} from '@eims/shared';

@ApiTags('ai-attendance')
@ApiBearerAuth()
@Controller('ai-attendance')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AiAttendanceController {
  constructor(private readonly service: AiAttendanceService) {}

  @Get('sessions')
  @Permissions('ai_attendance.use')
  list(
    @Query(createZodPipe(listOcrSessionsQuerySchema)) query: ListOcrSessionsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.list(query, scope);
  }

  @Get('sessions/:id')
  @Permissions('ai_attendance.use')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.service.findOne(id, scope);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('ai_attendance.use')
  create(
    @Body(createZodPipe(createOcrSessionSchema)) body: CreateOcrSessionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createSession(body, user);
  }

  @Post('sessions/:id/analyze')
  @Permissions('ai_attendance.use')
  analyze(
    @Param('id') id: string,
    @Body(createZodPipe(analyzeOcrSessionSchema)) body: AnalyzeOcrSessionInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.analyze(id, body, user, scope);
  }

  @Post('sessions/:id/confirm')
  @Permissions('ai_attendance.use')
  confirm(
    @Param('id') id: string,
    @Body(createZodPipe(confirmOcrSessionSchema)) body: ConfirmOcrSessionInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.confirm(id, body, user, scope);
  }
}
