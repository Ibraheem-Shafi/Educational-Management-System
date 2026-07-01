import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, Permissions } from '../../common/decorators/auth.decorators';

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
  getFeeDefaulters(@BranchId() branchId: string | null) {
    return this.reportsService.getFeeDefaulters(branchId);
  }
}
