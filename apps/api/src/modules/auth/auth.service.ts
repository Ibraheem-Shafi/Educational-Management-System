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
import type { AuthUser } from '@eims/types';
import type { AcceptInvitationInput, UpdateProfileInput } from '@eims/shared';

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
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      newValue: { fullName: updated.fullName, phone: updated.phone },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
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
  ) {}

  private async assertPortalEnabled(flag: 'parentPortal' | 'studentPortal') {
    const settings = await this.settingsService.getInstitutionSettings();
    if (settings.featureFlags?.[flag] === false) {
      throw new ForbiddenException('This portal is disabled for your institution');
    }
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
          this.assessmentsService.getStudentRecords(sp.student.id, sp.student.branchId),
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
      this.assessmentsService.getStudentRecords(student.id, student.branchId),
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
}
