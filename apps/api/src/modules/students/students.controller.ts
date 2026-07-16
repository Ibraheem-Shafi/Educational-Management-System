import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createStudentSchema, listStudentsQuerySchema, updateStudentSchema, setStudentSubjectsSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput, SetStudentSubjectsInput } from '@eims/shared';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(createZodPipe(listStudentsQuerySchema)) query: ListStudentsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.findAll(query, branchId);
  }

  @Get('stats')
  @Permissions('students.read')
  getStats(@BranchId() branchId: string | null) {
    return this.studentsService.getStats(branchId);
  }

  @Get(':id/subjects')
  @Permissions('students.read')
  listSubjects(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.studentsService.listSubjects(id, branchId);
  }

  @Put(':id/subjects')
  @Permissions('students.update')
  setSubjects(
    @Param('id') id: string,
    @Body(createZodPipe(setStudentSubjectsSchema)) body: SetStudentSubjectsInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.setSubjects(id, body.subjectIds, user, branchId);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(
    @Param('id') id: string,
    @Query('include') include: string | undefined,
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.findOne(id, branchId, include === 'subjects');
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
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.update(id, body, user, branchId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('students.delete')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.remove(id, user, branchId);
  }
}
