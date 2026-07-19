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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
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

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @Permissions('academic.read')
  findAll(
    @Query(createZodPipe(listProgramsQuerySchema)) query: ListProgramsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.programsService.findAll(query, branchId);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.programsService.findOne(id, branchId);
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
    @BranchId() branchId: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programsService.update(id, body, branchId, user);
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

  @Get()
  @Permissions('academic.read')
  findAll(
    @Query(createZodPipe(listBatchesQuerySchema)) query: ListBatchesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.batchesService.findAll(query, branchId);
  }

  @Get(':id/subjects')
  @Permissions('academic.read')
  listSubjects(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.batchSubjectsService.list(id, branchId);
  }

  @Put(':id/subjects')
  @Permissions('academic.manage')
  setSubjects(
    @Param('id') id: string,
    @Body(createZodPipe(setBatchSubjectsSchema)) body: SetBatchSubjectsInput,
    @BranchId() branchId: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchSubjectsService.set(id, body.subjectIds, branchId, user);
  }

  @Get(':id')
  @Permissions('academic.read')
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.batchesService.findOne(id, branchId);
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
    @BranchId() branchId: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batchesService.update(id, body, branchId, user);
  }
}

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

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
