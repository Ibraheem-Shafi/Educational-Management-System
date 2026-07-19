import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiInsightsService } from './ai-insights.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { atRiskStudentsQuerySchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { AtRiskStudentsQuery, BranchScope } from '@eims/shared';

@ApiTags('ai-insights')
@ApiBearerAuth()
@Controller('ai-insights')
@UseGuards(AuthGuard, PermissionsGuard)
export class AiInsightsController {
  constructor(private readonly service: AiInsightsService) {}

  // Branch-scoped routes still require a branch assignment.
  @Get('at-risk')
  @UseGuards(BranchGuard)
  @Permissions('ai_insights.read')
  atRisk(
    @Query(createZodPipe(atRiskStudentsQuerySchema)) query: AtRiskStudentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.getAtRiskStudents(query, scope);
  }

  @Get('students/:id/summary')
  @UseGuards(BranchGuard)
  @Permissions('ai_insights.read')
  studentSummary(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.service.getStudentSummary(id, scope);
  }

  // Portal route: parents have no branch assignment, so this must not run the
  // branch guard. The summary is resolved from the parent's email instead.
  @Get('portal/parent-summary')
  @Permissions('students.read')
  parentSummary(@CurrentUser() user: AuthUser) {
    return this.service.getParentSummary(user.email);
  }
}
