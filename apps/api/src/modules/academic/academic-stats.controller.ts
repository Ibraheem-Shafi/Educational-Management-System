import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcademicStatsService } from './academic-stats.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, Permissions } from '../../common/decorators/auth.decorators';

@ApiTags('academic')
@ApiBearerAuth()
@Controller('academic')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AcademicStatsController {
  constructor(private readonly statsService: AcademicStatsService) {}

  @Get('stats')
  @Permissions('academic.read')
  getStats(@BranchId() branchId: string | null) {
    return this.statsService.getStats(branchId);
  }
}
