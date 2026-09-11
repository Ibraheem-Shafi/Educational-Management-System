import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createRoleAccessSchema,
  updateRoleAccessSchema,
  type CreateRoleAccessInput,
  type UpdateRoleAccessInput,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import { AccessService } from './access.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('access')
@ApiBearerAuth()
@Controller('access')
@UseGuards(AuthGuard, SuperAdminGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('catalog')
  catalog() {
    return this.accessService.getCatalog();
  }

  @Get('roles')
  listRoles() {
    return this.accessService.listRoles();
  }

  @Post('roles')
  createRole(
    @Body(createZodPipe(createRoleAccessSchema)) body: CreateRoleAccessInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accessService.createRole(body, user);
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body(createZodPipe(updateRoleAccessSchema)) body: UpdateRoleAccessInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accessService.updateRole(id, body, user);
  }

  @Post('roles/:id/reset')
  resetRole(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accessService.resetRole(id, user);
  }
}
