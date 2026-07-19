import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { BranchScope, CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from '@eims/shared';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('stats')
  @Permissions('branches.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.branchesService.getStats(scope);
  }

  @Get()
  @Permissions('branches.read')
  findAll(
    @Query(createZodPipe(listBranchesQuerySchema)) query: ListBranchesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.branchesService.findAll(query, scope);
  }

  @Get(':id')
  @Permissions('branches.read')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.branchesService.findOne(id, scope);
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
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.update(id, body, scope, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('branches.manage')
  deactivate(
    @Param('id') id: string,
    @BranchScopeParam() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.deactivate(id, scope, user);
  }
}
