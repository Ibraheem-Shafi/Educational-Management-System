import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from '@eims/shared';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('stats')
  @Permissions('branches.read')
  getStats(@BranchId() branchId: string | null) {
    return this.branchesService.getStats(branchId);
  }

  @Get()
  @Permissions('branches.read')
  findAll(
    @Query(createZodPipe(listBranchesQuerySchema)) query: ListBranchesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.branchesService.findAll(query, branchId);
  }

  @Get(':id')
  @Permissions('branches.read')
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.branchesService.findOne(id, branchId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('branches.manage')
  create(
    @Body(createZodPipe(createBranchSchema)) body: CreateBranchInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.create(body, user);
  }

  @Patch(':id')
  @Permissions('branches.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateBranchSchema)) body: UpdateBranchInput,
    @BranchId() branchId: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.update(id, body, branchId, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('branches.manage')
  deactivate(
    @Param('id') id: string,
    @BranchId() branchId: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.deactivate(id, branchId, user);
  }
}
