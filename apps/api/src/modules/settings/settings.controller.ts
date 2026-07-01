import { Body, Controller, Get, Header, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, Permissions, Public } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { updateInstitutionSettingsSchema, createLookupStatusSchema, updateLookupStatusSchema } from '@eims/shared';
import type { AuthUser, UpdateInstitutionSettingsRequest } from '@eims/types';
import type { CreateLookupStatusInput, UpdateLookupStatusInput } from '@eims/shared';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('institution')
  @Header('Cache-Control', 'public, max-age=300')
  getInstitution() {
    return this.settingsService.getInstitutionSettings();
  }

  @Public()
  @Get('lookups/:category')
  @Header('Cache-Control', 'public, max-age=300')
  getLookups(@Param('category') category: string) {
    return this.settingsService.getLookups(category);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Patch('institution')
  @Permissions('settings.manage')
  updateInstitution(
    @Body(createZodPipe(updateInstitutionSettingsSchema)) body: UpdateInstitutionSettingsRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateInstitutionSettings(body, user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('lookups/:category/statuses')
  @Permissions('settings.manage')
  createLookupStatus(
    @Param('category') category: string,
    @Body(createZodPipe(createLookupStatusSchema)) body: CreateLookupStatusInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.createLookupStatus(category, body, user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Patch('lookups/:category/statuses/:id')
  @Permissions('settings.manage')
  updateLookupStatus(
    @Param('category') category: string,
    @Param('id') id: string,
    @Body(createZodPipe(updateLookupStatusSchema)) body: UpdateLookupStatusInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateLookupStatus(category, id, body, user);
  }
}
