import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService, PortalService } from './auth.service';
import { PortalTeacherService } from './portal-teacher.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public, SkipMfa } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  acceptInvitationSchema,
  updateProfileSchema,
  LEARNING_RESOURCE_TYPES,
  portalSectionQuerySchema,
  portalCalendarQuerySchema,
  createLeaveRequestSchema,
  leaveAttachmentMetaSchema,
  prepareLeaveAttachmentUploadSchema,
  paginationQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AcceptInvitationInput,
  CreateLeaveRequestInput,
  LeaveAttachmentMetaInput,
  PrepareLeaveAttachmentUploadInput,
  UpdateProfileInput,
} from '@eims/shared';
import { z } from 'zod';

const portalLearningQuerySchema = z.object({
  type: z.enum(LEARNING_RESOURCE_TYPES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  studentId: z.string().optional(),
});

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
  listSessions(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(paginationQuerySchema)) query: z.infer<typeof paginationQuerySchema>,
  ) {
    return this.authService.listSessions(user.id, query);
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
  constructor(
    private readonly portalService: PortalService,
    private readonly portalTeacherService: PortalTeacherService,
  ) {}

  @Get('student/stats')
  studentStats(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentStats(user);
  }

  @Get('student/learning/due-soon')
  studentLearningDueSoon(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentLearningDueSoon(user);
  }

  @Get('student/learning')
  studentLearning(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalLearningQuerySchema)) query: z.infer<typeof portalLearningQuerySchema>,
  ) {
    return this.portalService.getStudentLearning(user, query);
  }

  @Get('student/learning/:id')
  studentLearningDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.portalService.getStudentLearningDetail(user, id);
  }

  @Get('student/learning/:id/attachments/:attachmentId/signed-url')
  studentLearningSignedUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.portalService.getLearningAttachmentSignedUrl(user, id, attachmentId);
  }

  @Get('parent/stats')
  parentStats(@CurrentUser() user: AuthUser) {
    return this.portalService.getParentStats(user);
  }

  @Get('parent/learning/due-soon')
  parentLearningDueSoon(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalLearningQuerySchema)) query: z.infer<typeof portalLearningQuerySchema>,
  ) {
    if (!query.studentId) {
      return { data: [] };
    }
    return this.portalService.getParentLearningDueSoon(user, query.studentId);
  }

  @Get('parent/learning')
  parentLearning(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalLearningQuerySchema)) query: z.infer<typeof portalLearningQuerySchema>,
  ) {
    if (!query.studentId) {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
    return this.portalService.getParentLearning(user, query.studentId, query);
  }

  @Get('parent/learning/:id')
  parentLearningDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('studentId') studentId: string,
  ) {
    return this.portalService.getParentLearningDetail(user, studentId, id);
  }

  @Get('parent/learning/:id/attachments/:attachmentId/signed-url')
  parentLearningSignedUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.portalService.getLearningAttachmentSignedUrl(user, id, attachmentId, studentId);
  }

  @Get('parent')
  parentPortal(@CurrentUser() user: AuthUser) {
    return this.portalService.getParentPortal(user);
  }

  @Get('student')
  studentPortal(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentPortal(user);
  }

  @Get('student/attendance')
  studentAttendance(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getStudentAttendance(user, query);
  }

  @Get('student/assessments')
  studentAssessments(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getStudentAssessments(user, query);
  }

  @Get('student/fees')
  studentFees(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getStudentFees(user, query);
  }

  @Get('student/timetable')
  studentTimetable(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentTimetable(user);
  }

  @Get('student/notices')
  studentNotices(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getStudentNotices(user, query);
  }

  @Get('student/documents')
  studentDocuments(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getStudentDocuments(user, query);
  }

  @Get('student/documents/:id/signed-url')
  studentDocumentSignedUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.portalService.getStudentDocumentSignedUrl(user, id);
  }

  @Get('student/calendar')
  studentCalendar(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalCalendarQuerySchema)) query: z.infer<typeof portalCalendarQuerySchema>,
  ) {
    return this.portalService.getStudentCalendar(user, query.month);
  }

  @Get('student/insights')
  studentInsights(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentInsights(user);
  }

  @Get('student/profile')
  studentProfile(@CurrentUser() user: AuthUser) {
    return this.portalService.getStudentProfile(user);
  }

  @Get('parent/attendance')
  parentAttendance(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    if (!query.studentId) return { summary: { present: 0, absent: 0, late: 0, other: 0, presentRate: 0 }, records: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } };
    return this.portalService.getParentAttendance(user, query.studentId, query);
  }

  @Get('parent/assessments')
  parentAssessments(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    if (!query.studentId) return { averagePercentage: null, bySubject: [], records: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } };
    return this.portalService.getParentAssessments(user, query.studentId, query);
  }

  @Get('parent/fees')
  parentFees(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    if (!query.studentId) return { outstanding: 0, invoices: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } };
    return this.portalService.getParentFees(user, query.studentId, query);
  }

  @Get('parent/timetable')
  parentTimetable(@CurrentUser() user: AuthUser, @Query('studentId') studentId: string) {
    if (!studentId) return { slots: [], todaySlots: [] };
    return this.portalService.getParentTimetable(user, studentId);
  }

  @Get('parent/notices')
  parentNotices(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.getParentNotices(user, query);
  }

  @Get('parent/documents')
  parentDocuments(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    if (!query.studentId) return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    return this.portalService.getParentDocuments(user, query.studentId, query);
  }

  @Get('parent/documents/:id/signed-url')
  parentDocumentSignedUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('studentId') studentId: string,
  ) {
    return this.portalService.getParentDocumentSignedUrl(user, studentId, id);
  }

  @Get('parent/calendar')
  parentCalendar(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalCalendarQuerySchema)) query: z.infer<typeof portalCalendarQuerySchema>,
  ) {
    if (!query.studentId) return { month: query.month ?? new Date().toISOString().slice(0, 7), events: [] };
    return this.portalService.getParentCalendar(user, query.studentId, query.month);
  }

  @Get('parent/profile')
  parentProfile(@CurrentUser() user: AuthUser) {
    return this.portalService.getParentProfile(user);
  }

  @Get('parent/leave')
  parentLeaveList(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(portalSectionQuerySchema)) query: z.infer<typeof portalSectionQuerySchema>,
  ) {
    return this.portalService.listParentLeaveRequests(user, query.studentId, query);
  }

  @Post('parent/leave')
  @HttpCode(HttpStatus.CREATED)
  parentLeaveCreate(
    @CurrentUser() user: AuthUser,
    @Body(createZodPipe(createLeaveRequestSchema)) body: CreateLeaveRequestInput,
  ) {
    return this.portalService.createParentLeaveRequest(user, body);
  }

  @Post('parent/leave/:id/attachment/upload-url')
  parentLeavePrepareAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(prepareLeaveAttachmentUploadSchema)) body: PrepareLeaveAttachmentUploadInput,
  ) {
    return this.portalService.prepareParentLeaveAttachmentUpload(user, id, body);
  }

  @Post('parent/leave/:id/attachment')
  parentLeaveSetAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(leaveAttachmentMetaSchema)) body: LeaveAttachmentMetaInput,
  ) {
    return this.portalService.setParentLeaveAttachment(user, id, body);
  }

  @Get('parent/leave/:id/attachment/signed-url')
  parentLeaveAttachmentSignedUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.portalService.getParentLeaveAttachmentSignedUrl(user, id);
  }

  @Get('teacher/home')
  teacherHome(@CurrentUser() user: AuthUser) {
    return this.portalTeacherService.getHome(user);
  }

  @Get('teacher/batches')
  teacherBatches(@CurrentUser() user: AuthUser) {
    return this.portalTeacherService.getBatches(user);
  }

  @Get('teacher/students')
  teacherStudents(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('batchId') batchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portalTeacherService.getStudents(user, {
      search,
      batchId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('teacher/parents')
  teacherParents(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portalTeacherService.getParents(user, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('teacher/notices')
  teacherNotices(@CurrentUser() user: AuthUser) {
    return this.portalTeacherService.getNotices(user);
  }

  @Get('teacher/timetable')
  teacherTimetable(@CurrentUser() user: AuthUser) {
    return this.portalTeacherService.getTimetable(user);
  }
}
