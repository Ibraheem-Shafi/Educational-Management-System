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
import { CampusOpsService } from './campus-ops.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createComplianceControlSchema,
  createItOutageSchema,
  createSafetyIncidentSchema,
  createWorkOrderSchema,
  listComplianceControlsQuerySchema,
  listItOutagesQuerySchema,
  listSafetyIncidentsQuerySchema,
  listWorkOrdersQuerySchema,
  updateComplianceControlSchema,
  updateItOutageSchema,
  updateSafetyIncidentSchema,
  updateWorkOrderSchema,
} from '@eims/shared';
import { z } from 'zod';
import type { AuthUser } from '@eims/types';
import type {
  CreateComplianceControlInput,
  CreateItOutageInput,
  CreateSafetyIncidentInput,
  CreateWorkOrderInput,
  ListComplianceControlsQuery,
  ListItOutagesQuery,
  ListSafetyIncidentsQuery,
  ListWorkOrdersQuery,
  UpdateComplianceControlInput,
  UpdateItOutageInput,
  UpdateSafetyIncidentInput,
  UpdateWorkOrderInput,
} from '@eims/shared';

const itStatusQuerySchema = z.object({ branchId: z.string().optional() });

@ApiTags('campus-ops')
@ApiBearerAuth()
@Controller('campus-ops')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class CampusOpsController {
  constructor(private readonly campusOps: CampusOpsService) {}

  @Get('work-orders')
  @Permissions('settings.manage')
  listWorkOrders(
    @Query(createZodPipe(listWorkOrdersQuerySchema)) query: ListWorkOrdersQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.listWorkOrders(query, scope);
  }

  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('settings.manage')
  createWorkOrder(
    @Body(createZodPipe(createWorkOrderSchema)) body: CreateWorkOrderInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.campusOps.createWorkOrder(body, user);
  }

  @Patch('work-orders/:id')
  @Permissions('settings.manage')
  updateWorkOrder(
    @Param('id') id: string,
    @Body(createZodPipe(updateWorkOrderSchema)) body: UpdateWorkOrderInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.updateWorkOrder(id, body, user, scope);
  }

  @Delete('work-orders/:id')
  @Permissions('settings.manage')
  removeWorkOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.removeWorkOrder(id, user, scope);
  }

  @Get('safety')
  @Permissions('settings.manage')
  listSafety(
    @Query(createZodPipe(listSafetyIncidentsQuerySchema)) query: ListSafetyIncidentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.listSafety(query, scope);
  }

  @Post('safety')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('settings.manage')
  createSafety(
    @Body(createZodPipe(createSafetyIncidentSchema)) body: CreateSafetyIncidentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.campusOps.createSafety(body, user);
  }

  @Patch('safety/:id')
  @Permissions('settings.manage')
  updateSafety(
    @Param('id') id: string,
    @Body(createZodPipe(updateSafetyIncidentSchema)) body: UpdateSafetyIncidentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.updateSafety(id, body, user, scope);
  }

  @Delete('safety/:id')
  @Permissions('settings.manage')
  removeSafety(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.removeSafety(id, user, scope);
  }

  @Get('it-outages')
  @Permissions('settings.manage')
  listOutages(
    @Query(createZodPipe(listItOutagesQuerySchema)) query: ListItOutagesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.listOutages(query, scope);
  }

  @Post('it-outages')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('settings.manage')
  createOutage(
    @Body(createZodPipe(createItOutageSchema)) body: CreateItOutageInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.campusOps.createOutage(body, user);
  }

  @Patch('it-outages/:id')
  @Permissions('settings.manage')
  updateOutage(
    @Param('id') id: string,
    @Body(createZodPipe(updateItOutageSchema)) body: UpdateItOutageInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.updateOutage(id, body, user, scope);
  }

  @Delete('it-outages/:id')
  @Permissions('settings.manage')
  removeOutage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.removeOutage(id, user, scope);
  }

  @Get('it-status')
  @Permissions('settings.manage')
  itStatus(
    @Query(createZodPipe(itStatusQuerySchema)) query: { branchId?: string },
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.itStatus(query, scope);
  }

  @Get('compliance')
  @Permissions('settings.manage')
  listCompliance(
    @Query(createZodPipe(listComplianceControlsQuerySchema)) query: ListComplianceControlsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.listCompliance(query, scope);
  }

  @Post('compliance')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('settings.manage')
  createCompliance(
    @Body(createZodPipe(createComplianceControlSchema)) body: CreateComplianceControlInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.campusOps.createCompliance(body, user);
  }

  @Patch('compliance/:id')
  @Permissions('settings.manage')
  updateCompliance(
    @Param('id') id: string,
    @Body(createZodPipe(updateComplianceControlSchema)) body: UpdateComplianceControlInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.updateCompliance(id, body, user, scope);
  }

  @Delete('compliance/:id')
  @Permissions('settings.manage')
  removeCompliance(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.campusOps.removeCompliance(id, user, scope);
  }
}
