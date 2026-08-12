import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { listFeeDefaultersQuerySchema } from '@eims/shared';
import type { BranchScope, ListFeeDefaultersQuery } from '@eims/shared';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Permissions('reports.view')
  getOverview(@BranchScopeParam() scope: BranchScope) {
    return this.reportsService.getOverview(scope);
  }

  @Get('fee-defaulters')
  @Permissions('reports.view')
  getFeeDefaulters(
    @BranchScopeParam() scope: BranchScope,
    @Query(createZodPipe(listFeeDefaultersQuerySchema)) query: ListFeeDefaultersQuery,
  ) {
    return this.reportsService.getFeeDefaulters(scope, query);
  }
}
