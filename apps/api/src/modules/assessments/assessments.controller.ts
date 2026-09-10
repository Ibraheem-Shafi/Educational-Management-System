import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AssessmentsService } from './assessments.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  listAssessmentsQuerySchema,
  listAssessmentTypesQuerySchema,
  listAssessmentSeriesQuerySchema,
  marksSheetQuerySchema,
  bulkMarksSchema,
  reportCardsQuerySchema,
  createAssessmentTypeSchema,
  updateAssessmentTypeSchema,
  createAssessmentSeriesSchema,
  updateAssessmentSeriesSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  ListAssessmentsQuery,
  ListAssessmentTypesQuery,
  ListAssessmentSeriesQuery,
  MarksSheetQuery,
  BulkMarksInput,
  ReportCardsQuery,
  CreateAssessmentTypeInput,
  UpdateAssessmentTypeInput,
  CreateAssessmentSeriesInput,
  UpdateAssessmentSeriesInput,
} from '@eims/shared';

@ApiTags('assessments')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get('assessment-types')
  @Permissions('assessments.read')
  listTypes(@Query(createZodPipe(listAssessmentTypesQuerySchema)) query: ListAssessmentTypesQuery) {
    return this.assessmentsService.listTypes(query);
  }

  @Post('assessment-types')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createType(
    @Body(createZodPipe(createAssessmentTypeSchema)) body: CreateAssessmentTypeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.createType(body, user);
  }

  @Patch('assessment-types/:id')
  @Permissions('academic.manage')
  updateType(
    @Param('id') id: string,
    @Body(createZodPipe(updateAssessmentTypeSchema)) body: UpdateAssessmentTypeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.updateType(id, body, user);
  }

  @Get('assessment-series')
  @Permissions('assessments.read')
  listSeries(@Query(createZodPipe(listAssessmentSeriesQuerySchema)) query: ListAssessmentSeriesQuery) {
    return this.assessmentsService.listSeries(query);
  }

  @Post('assessment-series')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createSeries(
    @Body(createZodPipe(createAssessmentSeriesSchema)) body: CreateAssessmentSeriesInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.createSeries(body, user);
  }

  @Patch('assessment-series/:id')
  @Permissions('academic.manage')
  updateSeries(
    @Param('id') id: string,
    @Body(createZodPipe(updateAssessmentSeriesSchema)) body: UpdateAssessmentSeriesInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.updateSeries(id, body, user);
  }

  @Get('assessments/stats')
  @Permissions('assessments.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.assessmentsService.getStats(scope);
  }

  @Get('report-cards')
  @Permissions('assessments.read')
  getReportCard(
    @Query(createZodPipe(reportCardsQuerySchema)) query: ReportCardsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.getReportCard(query, scope);
  }

  @Get('assessments')
  @Permissions('assessments.read')
  findAll(
    @Query(createZodPipe(listAssessmentsQuerySchema)) query: ListAssessmentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.findAll(query, scope);
  }

  @Post('assessments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('assessments.marks.enter')
  create(
    @Body(createZodPipe(createAssessmentSchema)) body: CreateAssessmentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.create(body, user);
  }

  @Get('assessments/:id')
  @Permissions('assessments.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.assessmentsService.findOne(id, scope);
  }

  @Patch('assessments/:id')
  @Permissions('assessments.marks.enter')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateAssessmentSchema)) body: UpdateAssessmentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.update(id, body, user, scope);
  }

  @Post('assessments/:id/submit-review')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.marks.enter')
  submitReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.submitReview(id, user, scope);
  }

  @Post('assessments/:id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.publish(id, user, scope);
  }

  @Post('assessments/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.publish')
  unpublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.unpublish(id, user, scope);
  }

  @Get('assessments/:id/marks-sheet')
  @Permissions('assessments.read')
  getMarksSheet(
    @Param('id') id: string,
    @Query(createZodPipe(marksSheetQuerySchema)) query: MarksSheetQuery,
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assessmentsService.getMarksSheet(id, query, scope, user);
  }

  @Get('assessments/:id/export.csv')
  @Permissions('assessments.read')
  async exportCsv(
    @Param('id') id: string,
    @Query(createZodPipe(marksSheetQuerySchema)) query: MarksSheetQuery,
    @BranchScopeParam() scope: BranchScope,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.assessmentsService.exportMarksCsv(id, query, scope);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('assessments/:id/marks/bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.marks.enter')
  bulkMarks(
    @Param('id') id: string,
    @Body(createZodPipe(bulkMarksSchema)) body: BulkMarksInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.bulkMarks(id, body, user, scope);
  }

  @Get('students/:studentId/assessment-records')
  @Permissions('assessments.read')
  getStudentRecords(
    @Param('studentId') studentId: string,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.assessmentsService.getStudentRecords(studentId, scope);
  }
}
