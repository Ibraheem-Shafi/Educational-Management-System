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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
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
    @BranchId() branchId: string | null,
  ) {
    return this.usersService.findAll(query, branchId);
  }

  @Get('stats')
  @Permissions('users.manage')
  getStats(@BranchId() branchId: string | null) {
    return this.usersService.getStats(branchId);
  }

  @Get('roles')
  @Permissions('users.manage')
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get('invitations')
  @Permissions('users.manage')
  listInvitations(@BranchId() branchId: string | null) {
    return this.usersService.listInvitations(branchId);
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
  findOne(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.usersService.findOne(id, branchId);
  }

  @Patch(':id')
  @Permissions('users.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.usersService.update(id, body, user, branchId);
  }
}
