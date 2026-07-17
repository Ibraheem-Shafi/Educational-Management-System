import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { registerDeviceTokenSchema, unregisterDeviceTokenSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { RegisterDeviceTokenInput, UnregisterDeviceTokenInput } from '@eims/shared';
import { DeviceTokensService } from './device-tokens.service';

@ApiTags('device-tokens')
@ApiBearerAuth()
@Controller('device-tokens')
@UseGuards(AuthGuard)
export class DeviceTokensController {
  constructor(private readonly deviceTokensService: DeviceTokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  register(
    @CurrentUser() user: AuthUser,
    @Body(createZodPipe(registerDeviceTokenSchema)) body: RegisterDeviceTokenInput,
  ) {
    return this.deviceTokensService.register(user, body);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  unregister(
    @CurrentUser() user: AuthUser,
    @Body(createZodPipe(unregisterDeviceTokenSchema)) body: UnregisterDeviceTokenInput,
  ) {
    return this.deviceTokensService.unregister(user, body.token);
  }
}
