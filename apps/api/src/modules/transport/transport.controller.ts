import type { BranchScope } from '@eims/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransportService } from './transport.service';
import { TransportGpsWebhookGuard } from './transport-gps-webhook.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions, Public } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  bulkTransportAttendanceSchema,
  createStudentTransportSchema,
  createTransportRouteSchema,
  createTransportTripSchema,
  createTransportVehicleDocumentSchema,
  createTransportVehicleSchema,
  listStudentTransportQuerySchema,
  listTransportRoutesQuerySchema,
  listTransportTripsQuerySchema,
  listTransportVehiclesQuerySchema,
  transportGpsWebhookSchema,
  updateStudentTransportSchema,
  updateTransportRouteSchema,
  updateTransportTripSchema,
  updateTransportVehicleSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BulkTransportAttendanceInput,
  CreateStudentTransportInput,
  CreateTransportRouteInput,
  CreateTransportTripInput,
  CreateTransportVehicleDocumentInput,
  CreateTransportVehicleInput,
  ListStudentTransportQuery,
  ListTransportRoutesQuery,
  ListTransportTripsQuery,
  ListTransportVehiclesQuery,
  TransportGpsWebhookInput,
  UpdateStudentTransportInput,
  UpdateTransportRouteInput,
  UpdateTransportTripInput,
  UpdateTransportVehicleInput,
} from '@eims/shared';

@ApiTags('transport')
@ApiBearerAuth()
@Controller('transport')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // --- Vehicles ---

  @Get('vehicles')
  @Permissions('transport.read')
  findAllVehicles(
    @Query(createZodPipe(listTransportVehiclesQuerySchema)) query: ListTransportVehiclesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.findAllVehicles(query, scope);
  }

  @Get('vehicles/:id')
  @Permissions('transport.read')
  findOneVehicle(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.transportService.findOneVehicle(id, scope);
  }

  @Post('vehicles')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('transport.manage')
  createVehicle(
    @Body(createZodPipe(createTransportVehicleSchema)) body: CreateTransportVehicleInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.createVehicle(body, user);
  }

  @Patch('vehicles/:id')
  @Permissions('transport.manage')
  updateVehicle(
    @Param('id') id: string,
    @Body(createZodPipe(updateTransportVehicleSchema)) body: UpdateTransportVehicleInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.updateVehicle(id, body, user, scope);
  }

  @Delete('vehicles/:id')
  @Permissions('transport.manage')
  removeVehicle(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.removeVehicle(id, user, scope);
  }

  @Post('vehicles/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('transport.manage')
  addVehicleDocument(
    @Param('id') id: string,
    @Body(createZodPipe(createTransportVehicleDocumentSchema)) body: CreateTransportVehicleDocumentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.addVehicleDocument(id, body, user, scope);
  }

  @Delete('vehicles/:vehicleId/documents/:documentId')
  @Permissions('transport.manage')
  removeVehicleDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.removeVehicleDocument(documentId, user, scope);
  }

  // --- Routes ---

  @Get('routes')
  @Permissions('transport.read')
  findAllRoutes(
    @Query(createZodPipe(listTransportRoutesQuerySchema)) query: ListTransportRoutesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.findAllRoutes(query, scope);
  }

  @Get('routes/:id')
  @Permissions('transport.read')
  findOneRoute(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.transportService.findOneRoute(id, scope);
  }

  @Post('routes')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('transport.manage')
  createRoute(
    @Body(createZodPipe(createTransportRouteSchema)) body: CreateTransportRouteInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.createRoute(body, user);
  }

  @Patch('routes/:id')
  @Permissions('transport.manage')
  updateRoute(
    @Param('id') id: string,
    @Body(createZodPipe(updateTransportRouteSchema)) body: UpdateTransportRouteInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.updateRoute(id, body, user, scope);
  }

  @Delete('routes/:id')
  @Permissions('transport.manage')
  removeRoute(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.removeRoute(id, user, scope);
  }

  // --- Student assignments ---

  @Get('student-assignments')
  @Permissions('transport.read')
  findAllStudentAssignments(
    @Query(createZodPipe(listStudentTransportQuerySchema)) query: ListStudentTransportQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.findAllStudentAssignments(query, scope);
  }

  @Post('student-assignments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('transport.manage')
  createStudentAssignment(
    @Body(createZodPipe(createStudentTransportSchema)) body: CreateStudentTransportInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.createStudentAssignment(body, user);
  }

  @Patch('student-assignments/:id')
  @Permissions('transport.manage')
  updateStudentAssignment(
    @Param('id') id: string,
    @Body(createZodPipe(updateStudentTransportSchema)) body: UpdateStudentTransportInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.updateStudentAssignment(id, body, user, scope);
  }

  @Delete('student-assignments/:id')
  @Permissions('transport.manage')
  removeStudentAssignment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.removeStudentAssignment(id, user, scope);
  }

  // --- Trips ---

  @Get('trips')
  @Permissions('transport.read')
  findAllTrips(
    @Query(createZodPipe(listTransportTripsQuerySchema)) query: ListTransportTripsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.findAllTrips(query, scope);
  }

  @Get('trips/:id')
  @Permissions('transport.read')
  findOneTrip(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.transportService.findOneTrip(id, scope);
  }

  @Post('trips')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('transport.manage')
  createTrip(
    @Body(createZodPipe(createTransportTripSchema)) body: CreateTransportTripInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.createTrip(body, user);
  }

  @Patch('trips/:id')
  @Permissions('transport.manage')
  updateTrip(
    @Param('id') id: string,
    @Body(createZodPipe(updateTransportTripSchema)) body: UpdateTransportTripInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.updateTrip(id, body, user, scope);
  }

  @Post('trips/:id/attendance/bulk')
  @Permissions('transport.manage')
  bulkMarkTripAttendance(
    @Param('id') id: string,
    @Body(createZodPipe(bulkTransportAttendanceSchema)) body: BulkTransportAttendanceInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.transportService.bulkMarkTripAttendance(id, body, user, scope);
  }

  // --- GPS ---

  @Post('gps/webhook')
  @Public()
  @UseGuards(TransportGpsWebhookGuard)
  @HttpCode(HttpStatus.OK)
  gpsWebhook(
    @Body(createZodPipe(transportGpsWebhookSchema)) body: TransportGpsWebhookInput,
    @Req() req: { user?: AuthUser },
    @Headers('x-gps-webhook-secret') _secret?: string,
  ) {
    return this.transportService.handleGpsWebhook(body, req.user);
  }
}
