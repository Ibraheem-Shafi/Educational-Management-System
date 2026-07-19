import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcademicStatsService } from './academic-stats.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, Permissions } from '../../common/decorators/auth.decorators';
import type { BranchScope } from '@eims/shared';

@ApiTags('academic')
@ApiBearerAuth()
@Controller('academic')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AcademicStatsController {
  constructor(private readonly statsService: AcademicStatsService) {}

  @Get('stats')
  @Permissions('academic.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.statsService.getStats(scope);
  }
}
