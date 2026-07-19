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
import { BiometricService } from './biometric.service';
import { BiometricWebhookGuard } from './biometric-webhook.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions, Public } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  biometricPunchWebhookSchema,
  createBiometricDeviceSchema,
  createBiometricMappingSchema,
  listBiometricDevicesQuerySchema,
  listBiometricMappingsQuerySchema,
  listBiometricPunchLogsQuerySchema,
  updateBiometricDeviceSchema,
  updateBiometricMappingSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BiometricPunchWebhookInput,
  BranchScope,
  CreateBiometricDeviceInput,
  CreateBiometricMappingInput,
  ListBiometricDevicesQuery,
  ListBiometricMappingsQuery,
  ListBiometricPunchLogsQuery,
  UpdateBiometricDeviceInput,
  UpdateBiometricMappingInput,
} from '@eims/shared';

@ApiTags('biometric')
@ApiBearerAuth()
@Controller('biometric')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  @Get('devices')
  @Permissions('biometric.read')
  findAllDevices(
    @Query(createZodPipe(listBiometricDevicesQuerySchema)) query: ListBiometricDevicesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.findAllDevices(query, scope);
  }

  @Get('devices/:id')
  @Permissions('biometric.read')
  findOneDevice(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.biometricService.findOneDevice(id, scope);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('biometric.manage')
  createDevice(
    @Body(createZodPipe(createBiometricDeviceSchema)) body: CreateBiometricDeviceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.biometricService.createDevice(body, user);
  }

  @Patch('devices/:id')
  @Permissions('biometric.manage')
  updateDevice(
    @Param('id') id: string,
    @Body(createZodPipe(updateBiometricDeviceSchema)) body: UpdateBiometricDeviceInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.updateDevice(id, body, user, scope);
  }

  @Delete('devices/:id')
  @Permissions('biometric.manage')
  removeDevice(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.removeDevice(id, user, scope);
  }

  @Get('mappings')
  @Permissions('biometric.read')
  findAllMappings(
    @Query(createZodPipe(listBiometricMappingsQuerySchema)) query: ListBiometricMappingsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.findAllMappings(query, scope);
  }

  @Post('mappings')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('biometric.manage')
  createMapping(
    @Body(createZodPipe(createBiometricMappingSchema)) body: CreateBiometricMappingInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.biometricService.createMapping(body, user);
  }

  @Patch('mappings/:id')
  @Permissions('biometric.manage')
  updateMapping(
    @Param('id') id: string,
    @Body(createZodPipe(updateBiometricMappingSchema)) body: UpdateBiometricMappingInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.updateMapping(id, body, user, scope);
  }

  @Delete('mappings/:id')
  @Permissions('biometric.manage')
  removeMapping(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.removeMapping(id, user, scope);
  }

  @Get('punch-logs')
  @Permissions('biometric.read')
  findAllPunchLogs(
    @Query(createZodPipe(listBiometricPunchLogsQuerySchema)) query: ListBiometricPunchLogsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.biometricService.findAllPunchLogs(query, scope);
  }

  @Post('webhooks/punch')
  @Public()
  @UseGuards(BiometricWebhookGuard)
  @HttpCode(HttpStatus.OK)
  punchWebhook(
    @Body(createZodPipe(biometricPunchWebhookSchema)) body: BiometricPunchWebhookInput,
    @Req() req: { user?: AuthUser },
    @Headers('x-biometric-webhook-secret') _secret?: string,
  ) {
    return this.biometricService.handlePunchWebhook(body, req.user);
  }
}
