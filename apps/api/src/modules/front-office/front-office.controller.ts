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
import { FrontOfficeService } from './front-office.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions, Public } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  convertInquirySchema,
  createActivityNoteSchema,
  createComplaintSchema,
  createInquirySchema,
  createVisitorSchema,
  listActivitiesQuerySchema,
  listComplaintsQuerySchema,
  listInquiriesQuerySchema,
  listVisitorsQuerySchema,
  publicInquirySchema,
  updateComplaintSchema,
  updateInquirySchema,
  updateVisitorSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  ConvertInquiryInput,
  CreateActivityNoteInput,
  CreateComplaintInput,
  CreateInquiryInput,
  CreateVisitorInput,
  ListActivitiesQuery,
  ListComplaintsQuery,
  ListInquiriesQuery,
  ListVisitorsQuery,
  PublicInquiryInput,
  UpdateComplaintInput,
  UpdateInquiryInput,
  UpdateVisitorInput,
} from '@eims/shared';

@ApiTags('front-office')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class FrontOfficeController {
  constructor(private readonly frontOfficeService: FrontOfficeService) {}

  // --- Inquiries ---

  @Public()
  @Get('public/branches')
  listPublicBranches() {
    return this.frontOfficeService.listPublicBranches();
  }

  @Public()
  @Post('public/inquiries')
  @HttpCode(HttpStatus.CREATED)
  createPublicInquiry(@Body(createZodPipe(publicInquirySchema)) body: PublicInquiryInput) {
    return this.frontOfficeService.createPublicInquiry(body);
  }

  @Get('inquiries')
  @Permissions('front_office.read')
  findAllInquiries(
    @Query(createZodPipe(listInquiriesQuerySchema)) query: ListInquiriesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.findAllInquiries(query, scope);
  }

  @Get('inquiries/:id/convert')
  @Permissions('front_office.read')
  getConvertPayload(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.frontOfficeService.getConvertPayload(id, scope);
  }

  @Get('inquiries/:id')
  @Permissions('front_office.read')
  findOneInquiry(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.frontOfficeService.findOneInquiry(id, scope);
  }

  @Post('inquiries')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('front_office.manage')
  createInquiry(
    @Body(createZodPipe(createInquirySchema)) body: CreateInquiryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.frontOfficeService.createInquiry(body, user);
  }

  @Patch('inquiries/:id')
  @Permissions('front_office.manage')
  updateInquiry(
    @Param('id') id: string,
    @Body(createZodPipe(updateInquirySchema)) body: UpdateInquiryInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.updateInquiry(id, body, user, scope);
  }

  @Post('inquiries/:id/convert')
  @Permissions('front_office.manage')
  convertInquiry(
    @Param('id') id: string,
    @Body(createZodPipe(convertInquirySchema)) body: ConvertInquiryInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.convertInquiry(id, body, user, scope);
  }

  @Delete('inquiries/:id')
  @Permissions('front_office.manage')
  removeInquiry(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.removeInquiry(id, user, scope);
  }

  // --- Visitors ---

  @Get('visitors')
  @Permissions('front_office.read')
  findAllVisitors(
    @Query(createZodPipe(listVisitorsQuerySchema)) query: ListVisitorsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.findAllVisitors(query, scope);
  }

  @Get('visitors/:id')
  @Permissions('front_office.read')
  findOneVisitor(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.frontOfficeService.findOneVisitor(id, scope);
  }

  @Post('visitors')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('front_office.manage')
  createVisitor(
    @Body(createZodPipe(createVisitorSchema)) body: CreateVisitorInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.frontOfficeService.createVisitor(body, user);
  }

  @Patch('visitors/:id')
  @Permissions('front_office.manage')
  updateVisitor(
    @Param('id') id: string,
    @Body(createZodPipe(updateVisitorSchema)) body: UpdateVisitorInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.updateVisitor(id, body, user, scope);
  }

  @Delete('visitors/:id')
  @Permissions('front_office.manage')
  removeVisitor(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.removeVisitor(id, user, scope);
  }

  // --- Complaints ---

  @Get('complaints')
  @Permissions('front_office.read')
  findAllComplaints(
    @Query(createZodPipe(listComplaintsQuerySchema)) query: ListComplaintsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.findAllComplaints(query, scope);
  }

  @Get('complaints/:id')
  @Permissions('front_office.read')
  findOneComplaint(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.frontOfficeService.findOneComplaint(id, scope);
  }

  @Post('complaints')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('front_office.manage')
  createComplaint(
    @Body(createZodPipe(createComplaintSchema)) body: CreateComplaintInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.frontOfficeService.createComplaint(body, user);
  }

  @Patch('complaints/:id')
  @Permissions('front_office.manage')
  updateComplaint(
    @Param('id') id: string,
    @Body(createZodPipe(updateComplaintSchema)) body: UpdateComplaintInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.updateComplaint(id, body, user, scope);
  }

  @Delete('complaints/:id')
  @Permissions('front_office.manage')
  removeComplaint(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.removeComplaint(id, user, scope);
  }

  // --- Reception activities ---

  @Get('reception/activities')
  @Permissions('front_office.read')
  findAllActivities(
    @Query(createZodPipe(listActivitiesQuerySchema)) query: ListActivitiesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.frontOfficeService.findAllActivities(query, scope);
  }

  @Post('reception/activities')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('front_office.manage')
  createActivityNote(
    @Body(createZodPipe(createActivityNoteSchema)) body: CreateActivityNoteInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.frontOfficeService.createActivityNote(body, user);
  }
}
