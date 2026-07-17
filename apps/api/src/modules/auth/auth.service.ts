import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { FeesService } from '../fees/fees.service';
import { NoticesService } from '../notices/notices.service';
import { SettingsService } from '../settings/settings.service';
import { LearningService } from '../learning/learning.service';
import { PortalSectionsService } from './portal-sections.service';
import { countWithTrend } from '../../common/utils/stats.util';
import type { AuthUser, PortalParentStatsResponse, PortalStudentStatsResponse } from '@eims/types';
import type {
  AcceptInvitationInput,
  CreateEmployeeLeaveRequestInput,
  CreateLeaveRequestInput,
  PortalSectionQuery,
  UpdateProfileInput,
} from '@eims/shared';

@Injectable()
export class AuthService {
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.supabaseAdmin = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  async getMe(user: AuthUser) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const appUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true },
    });

    if (!appUser?.lastLoginAt || appUser.lastLoginAt < fiveMinAgo) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const recentSession = await this.prisma.userSession.findFirst({
        where: { userId: user.id, lastActiveAt: { gte: fiveMinAgo } },
        orderBy: { lastActiveAt: 'desc' },
      });
      if (recentSession) {
        await this.prisma.userSession.update({
          where: { id: recentSession.id },
          data: { lastActiveAt: new Date() },
        });
      } else {
        await this.prisma.userSession.create({
          data: { userId: user.id, deviceInfo: 'web' },
        });
      }
    }

    return { user };
  }

  async updateProfile(user: AuthUser, input: UpdateProfileInput) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.cnic !== undefined ? { cnic: input.cnic } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      newValue: {
        fullName: updated.fullName,
        phone: updated.phone,
        gender: updated.gender,
        cnic: updated.cnic,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
      gender: updated.gender,
      cnic: updated.cnic,
    };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      take: 20,
    });
    return {
      data: sessions.map((s) => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { revoked: true };
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expired');

    const role = await this.prisma.role.findUnique({ where: { id: invitation.roleId } });
    return {
      email: invitation.email,
      role: role ? { code: role.code, name: role.name } : null,
      branchId: invitation.branchId,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(input: AcceptInvitationInput) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: input.token },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expired');

    const existingUser = await this.prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
    });
    if (existingUser) throw new ConflictException('Account already exists for this email');

    const { data: authData, error: authError } = await this.supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: input.password,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      throw new BadRequestException(authError?.message ?? 'Failed to create auth account');
    }

    const appUser = await this.prisma.user.create({
      data: {
        supabaseUserId: authData.user.id,
        email: invitation.email,
        fullName: input.fullName,
        branchId: invitation.branchId,
        ...(input.gender ? { gender: input.gender } : {}),
        ...(input.cnic ? { cnic: input.cnic } : {}),
      },
    });

    await this.prisma.userRole.create({
      data: {
        userId: appUser.id,
        roleId: invitation.roleId,
        branchId: invitation.branchId,
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const role = await this.prisma.role.findUnique({ where: { id: invitation.roleId } });
    if (role) {
      await this.syncAppMetadata(authData.user.id, [role.code], invitation.branchId);
    }

    await this.audit.log({
      userId: appUser.id,
      action: 'invitation.accepted',
      entityType: 'Invitation',
      entityId: invitation.id,
      newValue: { email: invitation.email },
    });

    return {
      success: true,
      email: appUser.email,
      message: 'Account created. You can now sign in.',
    };
  }

  /** Populate Supabase JWT app_metadata for RLS branch isolation (docs/12-security.md). */
  private async syncAppMetadata(
    supabaseUserId: string,
    roles: string[],
    branchId: string | null,
  ): Promise<void> {
    const primaryRole = roles.includes('super_admin')
      ? 'super_admin'
      : roles.includes('branch_admin')
        ? 'branch_admin'
        : roles[0] ?? null;

    await this.supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
      app_metadata: {
        role: primaryRole,
        branch_id: branchId,
      },
    });
  }
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
    private readonly feesService: FeesService,
    private readonly noticesService: NoticesService,
    private readonly settingsService: SettingsService,
    private readonly learningService: LearningService,
    private readonly portalSections: PortalSectionsService,
  ) {}

  private async assertPortalEnabled(flag: 'parentPortal' | 'studentPortal') {
    const settings = await this.settingsService.getInstitutionSettings();
    if (settings.featureFlags?.[flag] === false) {
      throw new ForbiddenException('This portal is disabled for your institution');
    }
  }

  async getStudentStats(user: AuthUser): Promise<PortalStudentStatsResponse> {
    await this.assertPortalEnabled('studentPortal');
    const portal = await this.getStudentPortal(user);
    if (!portal.student) {
      return {
        attendanceRate: countWithTrend(0, 0),
        outstandingFees: countWithTrend(0, 0),
        averageGrade: countWithTrend(0, 0),
        upcomingClasses: countWithTrend(0, 0),
      };
    }

    const present = portal.attendance?.filter((r) => r.status?.label?.toLowerCase().includes('present')).length ?? 0;
    const total = portal.attendance?.length ?? 0;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const grades = portal.assessments?.map((a) => a.percentage).filter((p): p is number => p !== null) ?? [];
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : 0;

    return {
      attendanceRate: countWithTrend(rate, rate),
      outstandingFees: countWithTrend(portal.fees?.outstanding ?? 0, 0),
      averageGrade: countWithTrend(avgGrade, avgGrade),
      upcomingClasses: countWithTrend(portal.timetable?.length ?? 0, 0),
    };
  }

  async getParentStats(user: AuthUser): Promise<PortalParentStatsResponse> {
    await this.assertPortalEnabled('parentPortal');
    const portal = await this.getParentPortal(user);
    const children = portal.children ?? [];
    const totalOutstanding = children.reduce((s, c) => s + (c.fees?.outstanding ?? 0), 0);
    const attendanceRates = children.map((c) => {
      const present = c.attendance?.filter((r) => r.status?.label?.toLowerCase().includes('present')).length ?? 0;
      const total = c.attendance?.length ?? 0;
      return total > 0 ? Math.round((present / total) * 100) : 0;
    });
    const aggregateAttendance =
      attendanceRates.length > 0
        ? Math.round(attendanceRates.reduce((s, r) => s + r, 0) / attendanceRates.length)
        : 0;

    return {
      childrenCount: countWithTrend(children.length, children.length),
      aggregateAttendance: countWithTrend(aggregateAttendance, aggregateAttendance),
      totalOutstanding: countWithTrend(totalOutstanding, 0),
      recentNotices: countWithTrend(portal.notices?.length ?? 0, 0),
    };
  }

  async getParentPortal(user: AuthUser) {
    await this.assertPortalEnabled('parentPortal');
    if (!user.roles.includes('parent')) {
      throw new ForbiddenException('Parent portal access only');
    }

    const parent = await this.prisma.parent.findFirst({
      where: { email: user.email, deletedAt: null },
      include: {
        studentParents: {
          include: {
            student: {
              select: { id: true, fullName: true, branchId: true, batchId: true },
            },
          },
        },
      },
    });

    if (!parent) {
      return {
        parent: null,
        children: [],
        message: 'No parent profile linked to your email. Contact the institution.',
      };
    }

    const children = await Promise.all(
      parent.studentParents.map(async (sp) => {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const fromStr = from.toISOString().slice(0, 10);

        const [assessments, fees, attendance, timetableSlots] = await Promise.all([
          this.assessmentsService.getStudentRecords(sp.student.id, sp.student.branchId, true),
          this.feesService.getStudentFees(sp.student.id, sp.student.branchId),
          this.attendanceService.getHistory(
            { studentId: sp.student.id, from: fromStr, to },
            sp.student.branchId,
          ),
          sp.student.batchId
            ? this.prisma.timetableSlot.findMany({
                where: {
                  batchId: sp.student.batchId,
                  branchId: sp.student.branchId,
                  isActive: true,
                },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
              })
            : Promise.resolve([]),
        ]);

        const subjectIds = [...new Set(timetableSlots.map((s) => s.subjectId))];
        const subjects = subjectIds.length
          ? await this.prisma.subject.findMany({
              where: { id: { in: subjectIds } },
              select: { id: true, name: true },
            })
          : [];
        const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

        return {
          student: sp.student,
          relationshipCode: sp.relationshipCode,
          attendance: attendance.records.slice(0, 10),
          assessments: assessments.records.slice(0, 5),
          fees: {
            outstanding: fees.outstanding,
            recent: fees.invoices.slice(0, 5),
          },
          timetable: timetableSlots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            subjectName: subjectMap.get(slot.subjectId) ?? null,
          })),
        };
      }),
    );

    const notices = await this.noticesService.getPortalNotices(user, user.branchId);

    return {
      parent: { id: parent.id, fullName: parent.fullName, email: parent.email },
      children,
      notices: notices.data,
    };
  }

  async getStudentPortal(user: AuthUser) {
    await this.assertPortalEnabled('studentPortal');
    if (!user.roles.includes('student')) {
      throw new ForbiddenException('Student portal access only');
    }

    const student = await this.prisma.student.findFirst({
      where: { email: user.email, deletedAt: null },
      include: { batch: true, program: true },
    });

    if (!student) {
      return {
        student: null,
        message: 'No student profile linked to your email. Contact the institution.',
      };
    }

    const to = new Date().toISOString().slice(0, 10);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);

    const [attendance, assessments, fees, notices, timetableSlots] = await Promise.all([
      this.attendanceService.getHistory(
        { studentId: student.id, from: fromStr, to },
        student.branchId,
      ),
      this.assessmentsService.getStudentRecords(student.id, student.branchId, true),
      this.feesService.getStudentFees(student.id, student.branchId),
      this.noticesService.getPortalNotices(user, student.branchId),
      student.batchId
        ? this.prisma.timetableSlot.findMany({
            where: { batchId: student.batchId, branchId: student.branchId, isActive: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    const subjectIds = [...new Set(timetableSlots.map((s) => s.subjectId))];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
      : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        batch: student.batch,
        program: student.program,
      },
      attendance: attendance.records.slice(0, 10),
      assessments: assessments.records.slice(0, 10),
      fees: {
        outstanding: fees.outstanding,
        invoices: fees.invoices.slice(0, 10),
      },
      notices: notices.data,
      timetable: timetableSlots.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        subjectName: subjectMap.get(slot.subjectId) ?? null,
      })),
    };
  }

  private async resolveStudentContext(user: AuthUser) {
    await this.assertPortalEnabled('studentPortal');
    if (!user.roles.includes('student')) {
      throw new ForbiddenException('Student portal access only');
    }
    const student = await this.prisma.student.findFirst({
      where: { email: user.email, deletedAt: null },
      select: { id: true, branchId: true, programId: true, batchId: true },
    });
    if (!student) throw new ForbiddenException('No student profile linked');
    return student;
  }

  private async resolveParentChild(user: AuthUser, studentId: string) {
    await this.assertPortalEnabled('parentPortal');
    if (!user.roles.includes('parent')) {
      throw new ForbiddenException('Parent portal access only');
    }
    const parent = await this.prisma.parent.findFirst({
      where: { email: user.email, deletedAt: null },
      include: {
        studentParents: {
          where: { studentId },
          include: {
            student: {
              select: { id: true, branchId: true, programId: true, batchId: true, fullName: true },
            },
          },
        },
      },
    });
    const link = parent?.studentParents[0];
    if (!link) throw new ForbiddenException('Student not linked to your parent profile');
    return link.student;
  }

  async getStudentLearning(
    user: AuthUser,
    query: { type?: string; search?: string; page?: number; limit?: number },
  ) {
    const student = await this.resolveStudentContext(user);
    return this.learningService.listForStudentContext({
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'students',
      type: query.type,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  async getStudentLearningDetail(user: AuthUser, id: string) {
    const student = await this.resolveStudentContext(user);
    return this.learningService.findOnePublishedForStudent(id, {
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'students',
    });
  }

  async getStudentLearningDueSoon(user: AuthUser) {
    const student = await this.resolveStudentContext(user);
    return {
      data: await this.learningService.getDueSoonForStudent({
        branchId: student.branchId,
        programId: student.programId,
        batchId: student.batchId,
        audience: 'students',
        limit: 3,
      }),
    };
  }

  async getParentLearning(
    user: AuthUser,
    studentId: string,
    query: { type?: string; search?: string; page?: number; limit?: number },
  ) {
    const student = await this.resolveParentChild(user, studentId);
    return this.learningService.listForStudentContext({
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'parents',
      type: query.type,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  async getParentLearningDetail(user: AuthUser, studentId: string, id: string) {
    const student = await this.resolveParentChild(user, studentId);
    return this.learningService.findOnePublishedForStudent(id, {
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'parents',
    });
  }

  async getParentLearningDueSoon(user: AuthUser, studentId: string) {
    const student = await this.resolveParentChild(user, studentId);
    return {
      data: await this.learningService.getDueSoonForStudent({
        branchId: student.branchId,
        programId: student.programId,
        batchId: student.batchId,
        audience: 'parents',
        limit: 3,
      }),
    };
  }

  async getLearningAttachmentSignedUrl(
    user: AuthUser,
    resourceId: string,
    attachmentId: string,
    studentId?: string,
  ) {
    let branchId: string;
    if (user.roles.includes('student')) {
      const student = await this.resolveStudentContext(user);
      branchId = student.branchId;
      await this.learningService.findOnePublishedForStudent(resourceId, {
        branchId: student.branchId,
        programId: student.programId,
        batchId: student.batchId,
        audience: 'students',
      });
    } else if (user.roles.includes('parent')) {
      if (!studentId) throw new ForbiddenException('studentId is required for parent access');
      const student = await this.resolveParentChild(user, studentId);
      branchId = student.branchId;
      await this.learningService.findOnePublishedForStudent(resourceId, {
        branchId: student.branchId,
        programId: student.programId,
        batchId: student.batchId,
        audience: 'parents',
      });
    } else {
      throw new ForbiddenException('Portal access only');
    }
    return this.learningService.getAttachmentSignedUrl(resourceId, attachmentId, branchId);
  }

  async getStudentAttendance(user: AuthUser, query: PortalSectionQuery) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentAttendance(student, query);
  }

  async getParentAttendance(user: AuthUser, studentId: string, query: PortalSectionQuery) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getStudentAttendance(student, query);
  }

  async getStudentAssessments(user: AuthUser, query: PortalSectionQuery) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentAssessments(student, query);
  }

  async getParentAssessments(user: AuthUser, studentId: string, query: PortalSectionQuery) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getStudentAssessments(student, query);
  }

  async getStudentFees(user: AuthUser, query: PortalSectionQuery) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentFees(student, query);
  }

  async getParentFees(user: AuthUser, studentId: string, query: PortalSectionQuery) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getStudentFees(student, query);
  }

  async getStudentTimetable(user: AuthUser) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentTimetable(student);
  }

  async getParentTimetable(user: AuthUser, studentId: string) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getStudentTimetable(student);
  }

  async getStudentNotices(user: AuthUser, query: PortalSectionQuery) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentNotices(user, student.branchId, query);
  }

  async getParentNotices(user: AuthUser, query: PortalSectionQuery) {
    await this.assertPortalEnabled('parentPortal');
    if (!user.roles.includes('parent')) throw new ForbiddenException('Parent portal access only');
    return this.portalSections.getParentNotices(user, user.branchId, query);
  }

  async getStudentDocuments(user: AuthUser, query: PortalSectionQuery) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentDocuments(student, query);
  }

  async getParentDocuments(user: AuthUser, studentId: string, query: PortalSectionQuery) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getStudentDocuments(student, query);
  }

  async getStudentDocumentSignedUrl(user: AuthUser, documentId: string) {
    const student = await this.resolveStudentContext(user);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, studentId: student.id, deletedAt: null },
    });
    if (!doc) throw new ForbiddenException('Document not found');
    return this.portalSections.getDocumentSignedUrl(documentId, student.branchId);
  }

  async getParentDocumentSignedUrl(user: AuthUser, studentId: string, documentId: string) {
    const student = await this.resolveParentChild(user, studentId);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, studentId: student.id, deletedAt: null },
    });
    if (!doc) throw new ForbiddenException('Document not found');
    return this.portalSections.getDocumentSignedUrl(documentId, student.branchId);
  }

  async getStudentCalendar(user: AuthUser, month?: string) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentCalendar(student, month);
  }

  async getParentCalendar(user: AuthUser, studentId: string, month?: string) {
    const student = await this.resolveParentChild(user, studentId);
    return this.portalSections.getParentCalendar(student, month);
  }

  async getStudentInsights(user: AuthUser) {
    const student = await this.resolveStudentContext(user);
    return this.portalSections.getStudentInsights(student);
  }

  async getStudentProfile(user: AuthUser) {
    await this.assertPortalEnabled('studentPortal');
    return this.portalSections.getStudentProfile(user);
  }

  async getParentProfile(user: AuthUser) {
    await this.assertPortalEnabled('parentPortal');
    return this.portalSections.getParentProfile(user);
  }

  async listParentLeaveRequests(user: AuthUser, studentId?: string) {
    await this.assertPortalEnabled('parentPortal');
    if (!user.roles.includes('parent')) throw new ForbiddenException('Parent portal access only');
    return this.portalSections.listParentLeaveRequests(user.email, studentId);
  }

  async createParentLeaveRequest(user: AuthUser, input: CreateLeaveRequestInput) {
    await this.assertPortalEnabled('parentPortal');
    if (!user.roles.includes('parent')) throw new ForbiddenException('Parent portal access only');
    return this.portalSections.createParentLeaveRequest(user.email, input);
  }

  async listStaffLeaveRequests(branchId: string | null, kind?: string) {
    return this.portalSections.listStaffLeaveRequests(branchId, kind);
  }

  async createEmployeeLeaveRequest(user: AuthUser, input: CreateEmployeeLeaveRequestInput) {
    return this.portalSections.createEmployeeLeaveRequest(user.id, input);
  }

  async listMyEmployeeLeaveRequests(user: AuthUser) {
    return this.portalSections.listMyEmployeeLeaveRequests(user.id);
  }

  async reviewLeaveRequest(user: AuthUser, id: string, status: 'approved' | 'rejected') {
    return this.portalSections.reviewLeaveRequest(id, status, user.id);
  }
}
