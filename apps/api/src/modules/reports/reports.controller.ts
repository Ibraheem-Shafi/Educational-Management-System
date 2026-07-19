import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { paginationQuerySchema } from '@eims/shared';
import type { PaginationQuery } from '@eims/shared';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Permissions('reports.view')
  getOverview(@BranchId() branchId: string | null) {
    return this.reportsService.getOverview(branchId);
  }

  @Get('fee-defaulters')
  @Permissions('reports.view')
  getFeeDefaulters(
    @BranchId() branchId: string | null,
    @Query(createZodPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.reportsService.getFeeDefaulters(branchId, query);
  }
}
