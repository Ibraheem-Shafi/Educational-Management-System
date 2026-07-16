import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { listAuditLogsQuerySchema } from '@eims/shared';
import type { ListAuditLogsQuery } from '@eims/shared';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('stats')
  @Permissions('audit.read')
  getStats() {
    return this.auditLogsService.getStats();
  }

  @Get()
  @Permissions('audit.read')
  findAll(@Query(createZodPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQuery) {
    return this.auditLogsService.findAll(query);
  }
}
