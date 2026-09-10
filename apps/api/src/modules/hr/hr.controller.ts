import type { BranchScope } from '@eims/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createApplicantSchema,
  createContractSchema,
  updateContractSchema,
  listApplicantsQuerySchema,
  listContractsQuerySchema,
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema,
  updateApplicantSchema,
  createStaffTrainingSchema,
  updateStaffTrainingSchema,
  listStaffTrainingsQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateApplicantInput,
  CreateContractInput,
  UpdateContractInput,
  ListApplicantsQuery,
  ListContractsQuery,
  CreateReviewInput,
  UpdateReviewInput,
  ListReviewsQuery,
  UpdateApplicantInput,
  CreateStaffTrainingInput,
  UpdateStaffTrainingInput,
  ListStaffTrainingsQuery,
} from '@eims/shared';
import { AcademicOpsService } from '../academic-ops/academic-ops.service';

@ApiTags('hr')
@ApiBearerAuth()
@Controller('hr')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly academicOps: AcademicOpsService,
  ) {}

  @Get('contracts')
  @Permissions('hr.read')
  findContracts(
    @Query(createZodPipe(listContractsQuerySchema)) query: ListContractsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.findContracts(query, scope);
  }

  @Get('contracts/:id')
  @Permissions('hr.read')
  findContract(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.hrService.findContract(id, scope);
  }

  @Post('contracts')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('hr.manage')
  createContract(
    @Body(createZodPipe(createContractSchema)) body: CreateContractInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hrService.createContract(body, user);
  }

  @Patch('contracts/:id')
  @Permissions('hr.manage')
  updateContract(
    @Param('id') id: string,
    @Body(createZodPipe(updateContractSchema)) body: UpdateContractInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.updateContract(id, body, user, scope);
  }

  @Delete('contracts/:id')
  @Permissions('hr.manage')
  removeContract(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.removeContract(id, user, scope);
  }

  @Get('reviews')
  @Permissions('hr.read')
  findReviews(
    @Query(createZodPipe(listReviewsQuerySchema)) query: ListReviewsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.findReviews(query, scope);
  }

  @Get('reviews/:id')
  @Permissions('hr.read')
  findReview(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.hrService.findReview(id, scope);
  }

  @Post('reviews')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('hr.manage')
  createReview(
    @Body(createZodPipe(createReviewSchema)) body: CreateReviewInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hrService.createReview(body, user);
  }

  @Patch('reviews/:id')
  @Permissions('hr.manage')
  updateReview(
    @Param('id') id: string,
    @Body(createZodPipe(updateReviewSchema)) body: UpdateReviewInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.updateReview(id, body, user, scope);
  }

  @Delete('reviews/:id')
  @Permissions('hr.manage')
  removeReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.removeReview(id, user, scope);
  }

  @Get('applicants')
  @Permissions('hr.read')
  findApplicants(
    @Query(createZodPipe(listApplicantsQuerySchema)) query: ListApplicantsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.findApplicants(query, scope);
  }

  @Post('applicants')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('hr.manage')
  createApplicant(
    @Body(createZodPipe(createApplicantSchema)) body: CreateApplicantInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hrService.createApplicant(body, user);
  }

  @Patch('applicants/:id')
  @Permissions('hr.manage')
  updateApplicant(
    @Param('id') id: string,
    @Body(createZodPipe(updateApplicantSchema)) body: UpdateApplicantInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.updateApplicant(id, body, user, scope);
  }

  @Delete('applicants/:id')
  @Permissions('hr.manage')
  removeApplicant(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.hrService.removeApplicant(id, user, scope);
  }

  @Get('trainings')
  @Permissions('hr.read')
  findTrainings(
    @Query(createZodPipe(listStaffTrainingsQuerySchema)) query: ListStaffTrainingsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listTrainings(query, scope);
  }

  @Post('trainings')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('hr.manage')
  createTraining(
    @Body(createZodPipe(createStaffTrainingSchema)) body: CreateStaffTrainingInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createTraining(body, user);
  }

  @Patch('trainings/:id')
  @Permissions('hr.manage')
  updateTraining(
    @Param('id') id: string,
    @Body(createZodPipe(updateStaffTrainingSchema)) body: UpdateStaffTrainingInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateTraining(id, body, user, scope);
  }

  @Delete('trainings/:id')
  @Permissions('hr.manage')
  removeTraining(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeTraining(id, user, scope);
  }
}
