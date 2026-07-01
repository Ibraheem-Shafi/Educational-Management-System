import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService, PortalService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public, SkipMfa } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { acceptInvitationSchema, updateProfileSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { AcceptInvitationInput, UpdateProfileInput } from '@eims/shared';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @SkipMfa()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(createZodPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.authService.updateProfile(user, body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeSession(user.id, id);
  }

  @Public()
  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.authService.getInvitationByToken(token);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.CREATED)
  acceptInvitation(@Body(createZodPipe(acceptInvitationSchema)) body: AcceptInvitationInput) {
    return this.authService.acceptInvitation(body);
  }
}

@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
@UseGuards(AuthGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('parent')
  parentPortal(@CurrentUser() user: AuthUser) {
    return this.portalService.getParentPortal(user);
  }

  @Get('student')
  studentPortal(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentPortal(user);
  }
}
