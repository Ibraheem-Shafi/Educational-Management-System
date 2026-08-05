import type { BranchScope } from '@eims/shared';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createStudentSchema, listStudentsQuerySchema, updateStudentSchema, setStudentSubjectsSchema, generateRollNumbersSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput, SetStudentSubjectsInput, GenerateRollNumbersInput } from '@eims/shared';
import { assertStaffCatalogAccess } from '../../common/utils/staff-catalog.util';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /** Lightweight catalog for staff dropdowns — no students.read required. */
  @Get('options')
  listOptions(
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
    @Query('branchId') branchId?: string,
    @Query('batchId') batchId?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    assertStaffCatalogAccess(user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.studentsService.listOptions(
      {
        branchId,
        batchId,
        q,
        ...(Number.isFinite(limit) ? { limit } : {}),
      },
      scope,
    );
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(createZodPipe(listStudentsQuerySchema)) query: ListStudentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.findAll(query, scope);
  }

  @Get('stats')
  @Permissions('students.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.studentsService.getStats(scope);
  }

  @Get(':id/roll-slip/print-data')
  @Permissions('students.read')
  getRollSlipPrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.studentsService.getRollSlipPrintData(id, scope);
  }

  @Get('rosters/:batchId/print-data')
  @Permissions('students.read')
  getRosterPrintData(@Param('batchId') batchId: string, @BranchScopeParam() scope: BranchScope) {
    return this.studentsService.getRosterPrintData(batchId, scope);
  }

  @Post('generate-roll-numbers')
  @HttpCode(HttpStatus.OK)
  @Permissions('students.update')
  generateRollNumbers(
    @Body(createZodPipe(generateRollNumbersSchema)) body: GenerateRollNumbersInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.generateRollNumbers(body, user, scope);
  }

  @Get(':id/subjects')
  @Permissions('students.read')
  listSubjects(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.studentsService.listSubjects(id, scope);
  }

  @Put(':id/subjects')
  @Permissions('students.update')
  setSubjects(
    @Param('id') id: string,
    @Body(createZodPipe(setStudentSubjectsSchema)) body: SetStudentSubjectsInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.setSubjects(id, body.subjectIds, user, scope);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(
    @Param('id') id: string,
    @Query('include') include: string | undefined,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.findOne(id, scope, include === 'subjects');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('students.create')
  create(
    @Body(createZodPipe(createStudentSchema)) body: CreateStudentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.create(body, user);
  }

  @Patch(':id')
  @Permissions('students.update')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateStudentSchema)) body: UpdateStudentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.update(id, body, user, scope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('students.delete')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.studentsService.remove(id, user, scope);
  }
}
