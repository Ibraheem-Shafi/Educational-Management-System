import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BranchScope } from '@eims/shared';
import { ParentsService } from './parents.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createParentSchema, listParentsQuerySchema, linkParentStudentSchema, listParentStudentsQuerySchema, listStudentParentsQuerySchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateParentInput, ListParentsQuery, LinkParentStudentInput, ListParentStudentsQuery, ListStudentParentsQuery } from '@eims/shared';

@ApiTags('parents')
@ApiBearerAuth()
@Controller('parents')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('stats')
  @Permissions('students.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.parentsService.getStats(scope);
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(createZodPipe(listParentsQuerySchema)) query: ListParentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.parentsService.findAll(query, scope);
  }

  @Get(':id/students')
  @Permissions('students.read')
  listLinkedStudents(
    @Param('id') id: string,
    @Query(createZodPipe(listParentStudentsQuerySchema)) query: ListParentStudentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.parentsService.listLinkedStudents(id, query, scope);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.parentsService.findOne(id, scope);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('students.update')
  create(
    @Body(createZodPipe(createParentSchema)) body: CreateParentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.parentsService.create(body, user, scope);
  }

  @Post(':id/link-student')
  @Permissions('students.update')
  linkStudent(
    @Param('id') id: string,
    @Body(createZodPipe(linkParentStudentSchema)) body: LinkParentStudentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.parentsService.linkStudent(id, body, user, scope);
  }

  @Delete(':id/students/:studentId')
  @Permissions('students.update')
  unlinkStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.parentsService.unlinkStudent(id, studentId, user);
  }
}

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class StudentParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get(':studentId/parents')
  @Permissions('students.read')
  getStudentParents(
    @Param('studentId') studentId: string,
    @Query(createZodPipe(listStudentParentsQuerySchema)) query: ListStudentParentsQuery,
  ) {
    return this.parentsService.getStudentParents(studentId, query);
  }
}
