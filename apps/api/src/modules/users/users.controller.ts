import type { BranchScope } from '@eims/shared';
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
import { UsersService } from './users.service';
import { AccessService } from '../access/access.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  listUsersQuerySchema,
  createInvitationSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateUserAccessSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  ListUsersQuery,
  CreateInvitationInput,
  UpdateUserInput,
  UpdateUserRoleInput,
  UpdateUserAccessInput,
} from '@eims/shared';
import { assertStaffCatalogAccess } from '../../common/utils/staff-catalog.util';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
  ) {}

  @Get()
  @Permissions('users.manage')
  findAll(
    @Query(createZodPipe(listUsersQuerySchema)) query: ListUsersQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.usersService.findAll(query, scope);
  }

  @Get('stats')
  @Permissions('users.manage')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.usersService.getStats(scope);
  }

  @Get('roles')
  @Permissions('users.manage')
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get('invitations')
  @Permissions('users.manage')
  listInvitations(@BranchScopeParam() scope: BranchScope) {
    return this.usersService.listInvitations(scope);
  }

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('users.manage')
  createInvitation(
    @Body(createZodPipe(createInvitationSchema)) body: CreateInvitationInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.createInvitation(body, user);
  }

  /** Lightweight catalog for staff dropdowns — no users.manage required. */
  @Get('options')
  listOptions(
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
    @Query('branchId') branchId?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('role') role?: string,
  ) {
    assertStaffCatalogAccess(user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.usersService.listOptions(scope, {
      branchId,
      q,
      role,
      ...(Number.isFinite(limit) ? { limit } : {}),
    });
  }

  @Get(':id/access')
  @UseGuards(SuperAdminGuard)
  getAccess(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.accessService.getUserAccess(id, scope);
  }

  @Put(':id/access')
  @UseGuards(SuperAdminGuard)
  updateAccess(
    @Param('id') id: string,
    @Body(createZodPipe(updateUserAccessSchema)) body: UpdateUserAccessInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accessService.updateUserAccess(id, body, user, scope);
  }

  @Patch(':id/role')
  @UseGuards(SuperAdminGuard)
  updateRole(
    @Param('id') id: string,
    @Body(createZodPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accessService.updateUserRole(id, body, user, scope);
  }

  @Get(':id')
  @Permissions('users.manage')
  findOne(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.usersService.findOne(id, scope);
  }

  @Patch(':id')
  @Permissions('users.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.usersService.update(id, body, user, scope);
  }
}
