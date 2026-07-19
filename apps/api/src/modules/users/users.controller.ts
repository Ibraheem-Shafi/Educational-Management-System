import type { BranchScope } from '@eims/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { listUsersQuerySchema, createInvitationSchema, updateUserSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { ListUsersQuery, CreateInvitationInput, UpdateUserInput } from '@eims/shared';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
