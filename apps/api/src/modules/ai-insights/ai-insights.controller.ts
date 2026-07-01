import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiInsightsService } from './ai-insights.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '@eims/types';

@ApiTags('ai-insights')
@ApiBearerAuth()
@Controller('ai-insights')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AiInsightsController {
  constructor(private readonly service: AiInsightsService) {}

  @Get('at-risk')
  @Permissions('ai_insights.read')
  atRisk(@BranchId() branchId: string | null) {
    return this.service.getAtRiskStudents(branchId);
  }

  @Get('students/:id/summary')
  @Permissions('ai_insights.read')
  studentSummary(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.service.getStudentSummary(id, branchId);
  }

  @Get('portal/parent-summary')
  @Permissions('students.read')
  parentSummary(@CurrentUser() user: AuthUser) {
    return this.service.getParentSummary(user.email);
  }
}
