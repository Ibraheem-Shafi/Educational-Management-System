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
import { CertificatesService } from './certificates.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  issueCertificateSchema,
  listIssuesQuerySchema,
  listTemplatesQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { IssueCertificateInput, ListIssuesQuery, ListTemplatesQuery } from '@eims/shared';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('certificates')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('templates')
  @Permissions('certificates.read')
  findTemplates(
    @Query(createZodPipe(listTemplatesQuerySchema)) query: ListTemplatesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.certificatesService.findAllTemplates(query, branchId);
  }

  @Get('issues')
  @Permissions('certificates.read')
  findIssues(
    @Query(createZodPipe(listIssuesQuerySchema)) query: ListIssuesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.certificatesService.findAllIssues(query, branchId);
  }

  @Get('issues/:id/print-data')
  @Permissions('certificates.read')
  getPrintData(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.certificatesService.getPrintData(id, branchId);
  }

  @Get('id-cards/:studentId/print-data')
  @Permissions('certificates.read')
  getIdCardPrintData(
    @Param('studentId') studentId: string,
    @BranchId() branchId: string | null,
  ) {
    return this.certificatesService.getIdCardPrintData(studentId, branchId);
  }

  @Post('issue')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('certificates.issue')
  issue(
    @Body(createZodPipe(issueCertificateSchema)) body: IssueCertificateInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.certificatesService.issue(body, user);
  }
}
