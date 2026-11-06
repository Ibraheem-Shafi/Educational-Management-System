import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  createImportJobSchema,
  createImportMappingProfileSchema,
  listImportErrorsQuerySchema,
  listImportJobsQuerySchema,
  listImportProfilesQuerySchema,
  parseImportFileSchema,
  prepareImportUploadSchema,
  updateImportMappingProfileSchema,
  type CreateImportJobInput,
  type CreateImportMappingProfileInput,
  type ImportPipelineType,
  type ListImportErrorsQuery,
  type ListImportJobsQuery,
  type ListImportProfilesQuery,
  type ParseImportFileInput,
  type PrepareImportUploadInput,
  type UpdateImportMappingProfileInput,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('pipelines')
  @Permissions('imports.manage')
  listPipelines() {
    return this.imports.listPipelines();
  }

  @Get('pipelines/:type/fields')
  @Permissions('imports.manage')
  getFields(@Param('type') type: ImportPipelineType) {
    return this.imports.getPipelineFields(type);
  }

  @Post('prepare-upload')
  @Permissions('imports.manage')
  prepareUpload(
    @Body(createZodPipe(prepareImportUploadSchema)) body: PrepareImportUploadInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.prepareUpload(body, user);
  }

  @Post('parse')
  @Permissions('imports.manage')
  parse(@Body(createZodPipe(parseImportFileSchema)) body: ParseImportFileInput) {
    return this.imports.parseFile(body);
  }

  @Get('jobs')
  @Permissions('imports.manage')
  listJobs(
    @Query(createZodPipe(listImportJobsQuerySchema)) query: ListImportJobsQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.listJobs(query, user);
  }

  @Post('jobs')
  @Permissions('imports.manage')
  createJob(
    @Body(createZodPipe(createImportJobSchema)) body: CreateImportJobInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.createJob(body, user);
  }

  @Get('jobs/:id')
  @Permissions('imports.manage')
  getJob(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.getJob(id, user);
  }

  @Post('jobs/:id/dry-run')
  @Permissions('imports.manage')
  dryRun(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.dryRun(id, user);
  }

  @Post('jobs/:id/start')
  @Permissions('imports.manage')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.start(id, user);
  }

  @Post('jobs/:id/resume')
  @Permissions('imports.manage')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.resume(id, user);
  }

  @Post('jobs/:id/cancel')
  @Permissions('imports.manage')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.cancel(id, user);
  }

  @Get('jobs/:id/errors')
  @Permissions('imports.manage')
  listErrors(
    @Param('id') id: string,
    @Query(createZodPipe(listImportErrorsQuerySchema)) query: ListImportErrorsQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.listErrors(id, query, user);
  }

  @Get('jobs/:id/errors.csv')
  @Permissions('imports.manage')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async errorsCsv(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const csv = await this.imports.errorsCsv(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${id}.csv"`);
    res.send(csv);
  }

  @Get('mapping-profiles')
  @Permissions('imports.manage')
  listProfiles(
    @Query(createZodPipe(listImportProfilesQuerySchema)) query: ListImportProfilesQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.listProfiles(query, user);
  }

  @Post('mapping-profiles')
  @Permissions('imports.manage')
  createProfile(
    @Body(createZodPipe(createImportMappingProfileSchema)) body: CreateImportMappingProfileInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.createProfile(body, user);
  }

  @Patch('mapping-profiles/:id')
  @Permissions('imports.manage')
  updateProfile(
    @Param('id') id: string,
    @Body(createZodPipe(updateImportMappingProfileSchema)) body: UpdateImportMappingProfileInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.updateProfile(id, body, user);
  }

  @Delete('mapping-profiles/:id')
  @Permissions('imports.manage')
  deleteProfile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.deleteProfile(id, user);
  }
}
