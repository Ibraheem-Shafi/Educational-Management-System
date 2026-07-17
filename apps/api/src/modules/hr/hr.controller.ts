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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createContractSchema,
  updateContractSchema,
  listContractsQuerySchema,
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateContractInput,
  UpdateContractInput,
  ListContractsQuery,
  CreateReviewInput,
  UpdateReviewInput,
  ListReviewsQuery,
} from '@eims/shared';

@ApiTags('hr')
@ApiBearerAuth()
@Controller('hr')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('contracts')
  @Permissions('hr.read')
  findContracts(
    @Query(createZodPipe(listContractsQuerySchema)) query: ListContractsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.findContracts(query, branchId);
  }

  @Get('contracts/:id')
  @Permissions('hr.read')
  findContract(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.hrService.findContract(id, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.updateContract(id, body, user, branchId);
  }

  @Delete('contracts/:id')
  @Permissions('hr.manage')
  removeContract(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.removeContract(id, user, branchId);
  }

  @Get('reviews')
  @Permissions('hr.read')
  findReviews(
    @Query(createZodPipe(listReviewsQuerySchema)) query: ListReviewsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.findReviews(query, branchId);
  }

  @Get('reviews/:id')
  @Permissions('hr.read')
  findReview(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.hrService.findReview(id, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.updateReview(id, body, user, branchId);
  }

  @Delete('reviews/:id')
  @Permissions('hr.manage')
  removeReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.hrService.removeReview(id, user, branchId);
  }
}
