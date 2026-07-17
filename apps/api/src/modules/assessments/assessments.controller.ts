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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  listAssessmentsQuerySchema,
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
  CreateAssessmentInput,
  UpdateAssessmentInput,
  ListAssessmentsQuery,
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
  listTypes(@Query('all') all?: string) {
    return this.assessmentsService.listTypes(all === 'true');
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
  listSeries() {
    return this.assessmentsService.listSeries();
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
  getStats(@BranchId() branchId: string | null) {
    return this.assessmentsService.getStats(branchId);
  }

  @Get('report-cards')
  @Permissions('assessments.read')
  getReportCard(
    @Query(createZodPipe(reportCardsQuerySchema)) query: ReportCardsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.getReportCard(query, branchId);
  }

  @Get('assessments')
  @Permissions('assessments.read')
  findAll(
    @Query(createZodPipe(listAssessmentsQuerySchema)) query: ListAssessmentsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.findAll(query, branchId);
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
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.assessmentsService.findOne(id, branchId);
  }

  @Patch('assessments/:id')
  @Permissions('assessments.marks.enter')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateAssessmentSchema)) body: UpdateAssessmentInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.update(id, body, user, branchId);
  }

  @Post('assessments/:id/submit-review')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.marks.enter')
  submitReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.submitReview(id, user, branchId);
  }

  @Post('assessments/:id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.publish(id, user, branchId);
  }

  @Post('assessments/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Permissions('assessments.publish')
  unpublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.unpublish(id, user, branchId);
  }

  @Get('assessments/:id/marks-sheet')
  @Permissions('assessments.read')
  getMarksSheet(
    @Param('id') id: string,
    @Query(createZodPipe(marksSheetQuerySchema)) query: MarksSheetQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.getMarksSheet(id, query, branchId);
  }

  @Get('assessments/:id/export.csv')
  @Permissions('assessments.read')
  async exportCsv(
    @Param('id') id: string,
    @Query(createZodPipe(marksSheetQuerySchema)) query: MarksSheetQuery,
    @BranchId() branchId: string | null,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.assessmentsService.exportMarksCsv(id, query, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.bulkMarks(id, body, user, branchId);
  }

  @Get('students/:studentId/assessment-records')
  @Permissions('assessments.read')
  getStudentRecords(
    @Param('studentId') studentId: string,
    @BranchId() branchId: string | null,
  ) {
    return this.assessmentsService.getStudentRecords(studentId, branchId);
  }
}
