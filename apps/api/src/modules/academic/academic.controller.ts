import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ProgramsService,
  BatchesService,
  SubjectsService,
  AcademicSessionsService,
  BatchSubjectsService,
} from './academic.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createProgramSchema,
  updateProgramSchema,
  listProgramsQuerySchema,
  createBatchSchema,
  updateBatchSchema,
  listBatchesQuerySchema,
  createSubjectSchema,
  updateSubjectSchema,
  listSubjectsQuerySchema,
  createAcademicSessionSchema,
  updateAcademicSessionSchema,
  listAcademicSessionsQuerySchema,
  setBatchSubjectsSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  CreateProgramInput,
  UpdateProgramInput,
  ListProgramsQuery,
  CreateBatchInput,
  UpdateBatchInput,
  ListBatchesQuery,
  CreateSubjectInput,
  UpdateSubjectInput,
  ListSubjectsQuery,
  CreateAcademicSessionInput,
  UpdateAcademicSessionInput,
  ListAcademicSessionsQuery,
  SetBatchSubjectsInput,
} from '@eims/shared';
import { assertStaffCatalogAccess } from '../../common/utils/staff-catalog.util';

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  /** Lightweight catalog for staff dropdowns — no academic.read required. */
  @Get('options')
  listOptions(
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
    @Query('branchId') branchId?: string,
  ) {
    assertStaffCatalogAccess(user);
    return this.programsService.listOptions(scope, { branchId });
  }

  @Get()
  @Permissions('academic.read')
  findAll(
    @Query(createZodPipe(listProgramsQuerySchema)) query: ListProgramsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.programsService.findAll(query, scope);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.programsService.findOne(id, scope);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  create(
    @Body(createZodPipe(createProgramSchema)) body: CreateProgramInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programsService.create(body, user);
  }

  @Patch(':id')
  @Permissions('academic.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateProgramSchema)) body: UpdateProgramInput,
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programsService.update(id, body, scope, user);
  }
}

@ApiTags('batches')
@ApiBearerAuth()
@Controller('batches')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly batchSubjectsService: BatchSubjectsService,
  ) {}

  /** Lightweight catalog for staff dropdowns — no academic.read required. */
  @Get('options')
  listOptions(
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
    @Query('branchId') branchId?: string,
    @Query('programId') programId?: string,
  ) {
    assertStaffCatalogAccess(user);
    return this.batchesService.listOptions(scope, { branchId, programId });
  }

  @Get()
  @Permissions('academic.read')
  findAll(
    @Query(createZodPipe(listBatchesQuerySchema)) query: ListBatchesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.batchesService.findAll(query, scope);
  }

  @Get(':id/subjects')
  @Permissions('academic.read')
  listSubjects(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.batchSubjectsService.list(id, scope);
  }

  @Put(':id/subjects')
  @Permissions('academic.manage')
  setSubjects(
    @Param('id') id: string,
    @Body(createZodPipe(setBatchSubjectsSchema)) body: SetBatchSubjectsInput,
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchSubjectsService.set(id, body.subjectIds, scope, user);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.batchesService.findOne(id, scope);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  create(
    @Body(createZodPipe(createBatchSchema)) body: CreateBatchInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.create(body, user);
  }

  @Patch(':id')
  @Permissions('academic.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateBatchSchema)) body: UpdateBatchInput,
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.update(id, body, scope, user);
  }
}

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  /** Lightweight catalog for staff dropdowns — no academic.read required. */
  @Get('options')
  listOptions(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    assertStaffCatalogAccess(user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.subjectsService.listOptions({
      q,
      ...(Number.isFinite(limit) ? { limit } : {}),
    });
  }

  @Get()
  @Permissions('academic.read')
  findAll(@Query(createZodPipe(listSubjectsQuerySchema)) query: ListSubjectsQuery) {
    return this.subjectsService.findAll(query);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  create(
    @Body(createZodPipe(createSubjectSchema)) body: CreateSubjectInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subjectsService.create(body, user);
  }

  @Patch(':id')
  @Permissions('academic.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateSubjectSchema)) body: UpdateSubjectInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subjectsService.update(id, body, user);
  }
}

@ApiTags('academic-sessions')
@ApiBearerAuth()
@Controller('academic-sessions')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AcademicSessionsController {
  constructor(private readonly sessionsService: AcademicSessionsService) {}

  @Get()
  @Permissions('academic.read')
  findAll(@Query(createZodPipe(listAcademicSessionsQuerySchema)) query: ListAcademicSessionsQuery) {
    return this.sessionsService.findAll(query);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  create(
    @Body(createZodPipe(createAcademicSessionSchema)) body: CreateAcademicSessionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionsService.create(body, user);
  }

  @Patch(':id')
  @Permissions('academic.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateAcademicSessionSchema)) body: UpdateAcademicSessionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionsService.update(id, body, user);
  }
}
