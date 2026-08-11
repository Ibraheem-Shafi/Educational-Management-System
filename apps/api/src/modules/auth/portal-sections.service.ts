import { prismaBranchFilter, prismaBranchIdFilter, scopeCacheKey, requireSingleBranchId, sqlBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { FeesService } from '../fees/fees.service';
import { LearningService } from '../learning/learning.service';
import { DocumentsService } from '../documents/documents.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import type { AuthUser, PaginatedResponse } from '@eims/types';
import { ATTENDANCE_ENTITY_STUDENT, selectedBranchScope } from '@eims/shared';
import type {
  CreateEmployeeLeaveRequestInput,
  CreateLeaveRequestInput,
  LeaveAttachmentMetaInput,
  PortalSectionQuery,
  PrepareLeaveAttachmentUploadInput,
} from '@eims/shared';
import { paginatedResult } from '../../common/utils/pagination.util';

const LEAVE_BUCKET = 'leave-attachments';

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function defaultDateRange(from?: string, to?: string) {
  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  if (from) {
    return { from, to: toDate };
  }
  fromDate.setDate(fromDate.getDate() - 90);
  return { from: fromDate.toISOString().slice(0, 10), to: toDate };
}

function attendanceSummary(records: Array<{ status?: { label: string } | null }>) {
  const counts = { present: 0, absent: 0, late: 0, other: 0 };
  for (const record of records) {
    const label = record.status?.label?.toLowerCase() ?? '';
    if (label.includes('present')) counts.present += 1;
    else if (label.includes('absent')) counts.absent += 1;
    else if (label.includes('late')) counts.late += 1;
    else counts.other += 1;
  }
  const total = Math.max(counts.present + counts.absent + counts.late + counts.other, 1);
  return {
    ...counts,
    presentRate: Math.round((counts.present / total) * 100),
  };
}

@Injectable()
export class PortalSectionsService implements OnModuleInit {
  private readonly logger = new Logger(PortalSectionsService.name);
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly feesService: FeesService,
    private readonly learningService: LearningService,
    private readonly documentsService: DocumentsService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabaseAdmin = createClient(url, key);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.ensureLeaveBucket();
  }

  private async ensureLeaveBucket(): Promise<void> {
    if (!this.supabaseAdmin) return;
    try {
      const { data } = await this.supabaseAdmin.storage.getBucket(LEAVE_BUCKET);
      if (!data) {
        await this.supabaseAdmin.storage.createBucket(LEAVE_BUCKET, { public: false });
        this.logger.log(`Created storage bucket "${LEAVE_BUCKET}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not verify/create storage bucket "${LEAVE_BUCKET}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private safeStorageFileName(name: string): string {
    const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '');
    return (base || 'file').slice(0, 120);
  }

  async getStudentAttendance(
    student: { id: string; branchId: string },
    query: PortalSectionQuery,
  ) {
    const range = defaultDateRange(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const from = parseDateOnly(range.from);
    const to = parseDateOnly(range.to);
    const where = {
      entityType: ATTENDANCE_ENTITY_STUDENT,
      entityId: student.id,
      date: { gte: from, lte: to },
    };

    const summaryRecords = await this.prisma.attendanceRecord.findMany({
      where,
      select: { statusId: true },
    });
    const summaryStatusIds = [...new Set(summaryRecords.map((r) => r.statusId))];
    const summaryStatuses = summaryStatusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: summaryStatusIds } },
          select: { id: true, label: true },
        })
      : [];
    const summaryStatusMap = new Map(summaryStatuses.map((s) => [s.id, s]));
    const summary = attendanceSummary(
      summaryRecords.map((r) => ({ status: summaryStatusMap.get(r.statusId) ?? null })),
    );

    const [total, records] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const statusIds = [...new Set(records.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.prisma.lookupStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, code: true, label: true },
        })
      : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s]));

    return {
      summary,
      records: paginatedResult(
        records.map((r) => ({
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          statusId: r.statusId,
          status: statusMap.get(r.statusId) ?? null,
          remarks: r.remarks,
          markedAt: r.updatedAt.toISOString(),
        })),
        total,
        page,
        limit,
      ),
    };
  }

  async getStudentAssessments(
    student: { id: string; branchId: string },
    query: PortalSectionQuery,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const recordWhere = {
      studentId: student.id,
      assessment: { status: 'published' },
    };

    const allRecords = await this.prisma.assessmentRecord.findMany({
      where: recordWhere,
      include: { assessment: { select: { name: true } } },
    });
    const allSubjectIds = [...new Set(allRecords.map((r) => r.subjectId))];
    const allSubjects = allSubjectIds.length
      ? await this.prisma.subject.findMany({ where: { id: { in: allSubjectIds } } })
      : [];
    const allSubjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));

    const mappedAll = allRecords.map((r) => ({
      id: r.id,
      assessment: r.assessment.name,
      subject: allSubjectMap.get(r.subjectId) ?? null,
      grade: r.grade,
      percentage: r.percentage ? Number(r.percentage) : null,
    }));

    const percentages = mappedAll.map((r) => r.percentage).filter((p): p is number => p !== null);
    const averagePercentage =
      percentages.length > 0
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
        : null;

    const subjectAgg = new Map<string, { sum: number; count: number }>();
    for (const row of mappedAll) {
      if (!row.subject || row.percentage === null) continue;
      const cur = subjectAgg.get(row.subject) ?? { sum: 0, count: 0 };
      cur.sum += row.percentage;
      cur.count += 1;
      subjectAgg.set(row.subject, cur);
    }
    const bySubject = [...subjectAgg.entries()].map(([subject, { sum, count }]) => ({
      subject,
      average: Math.round(sum / count),
      count,
    }));

    const [total, pageRecords] = await Promise.all([
      this.prisma.assessmentRecord.count({ where: recordWhere }),
      this.prisma.assessmentRecord.findMany({
        where: recordWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { assessment: { select: { name: true } } },
      }),
    ]);
    const pageSubjectIds = [...new Set(pageRecords.map((r) => r.subjectId))];
    const pageSubjects = pageSubjectIds.length
      ? await this.prisma.subject.findMany({ where: { id: { in: pageSubjectIds } } })
      : [];
    const pageSubjectMap = new Map(pageSubjects.map((s) => [s.id, s.name]));

    return {
      averagePercentage,
      bySubject,
      records: paginatedResult(
        pageRecords.map((r) => ({
          id: r.id,
          assessment: r.assessment.name,
          subject: pageSubjectMap.get(r.subjectId) ?? null,
          grade: r.grade,
          percentage: r.percentage ? Number(r.percentage) : null,
        })),
        total,
        page,
        limit,
      ),
    };
  }

  async getStudentFees(student: { id: string; branchId: string }, query: PortalSectionQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const studentScope = selectedBranchScope([student.branchId]);
    const [fees, invoicePage] = await Promise.all([
      this.feesService.getStudentFees(student.id, studentScope),
      this.feesService.findAll({ studentId: student.id, page, limit }, studentScope),
    ]);
    return {
      outstanding: fees.outstanding,
      invoices: paginatedResult(invoicePage.data, invoicePage.meta.total, page, limit),
    };
  }

  async getStudentTimetable(student: { id: string; branchId: string; batchId: string | null }) {
    if (!student.batchId) {
      return { slots: [], todaySlots: [] };
    }
    const slots = await this.fetchTimetableSlots(student.batchId, student.branchId);
    const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
    return {
      slots,
      todaySlots: slots.filter((s) => s.dayOfWeek === todayDow),
    };
  }

  async getStudentNotices(user: AuthUser, scope: BranchScope, query: PortalSectionQuery) {
    const audiences: string[] = ['all', 'students'];
    const where = {
      isPublished: true,
      audience: { in: audiences },
      ...prismaBranchFilter(scope),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { body: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [total, notices] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginatedResult(
      notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        audience: n.audience,
        publishedAt: n.publishedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async getParentNotices(user: AuthUser, scope: BranchScope, query: PortalSectionQuery) {
    const audiences: string[] = ['all', 'parents'];
    const where = {
      isPublished: true,
      audience: { in: audiences },
      ...prismaBranchFilter(scope),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { body: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [total, notices] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginatedResult(
      notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        audience: n.audience,
        publishedAt: n.publishedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async getStudentLearning(
    student: {
      id: string;
      branchId: string;
      programId: string | null;
      batchId: string | null;
    },
    query: { type?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const result = await this.learningService.listForStudentContext({
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'students',
      type: query.type,
      search: query.search,
      page,
      limit,
    });
    return paginatedResult(result.data, result.meta.total, page, limit);
  }

  async getParentLearning(
    student: {
      id: string;
      branchId: string;
      programId: string | null;
      batchId: string | null;
    },
    query: { type?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const result = await this.learningService.listForStudentContext({
      branchId: student.branchId,
      programId: student.programId,
      batchId: student.batchId,
      audience: 'parents',
      type: query.type,
      search: query.search,
      page,
      limit,
    });
    return paginatedResult(result.data, result.meta.total, page, limit);
  }

  async getStudentDocuments(student: { id: string; branchId: string }, query: PortalSectionQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const result = await this.documentsService.findAll(
      { studentId: student.id, page, limit },
      selectedBranchScope([student.branchId]),
    );
    return paginatedResult(
      result.data.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
      })),
      result.meta.total,
      page,
      limit,
    );
  }

  async getDocumentSignedUrl(documentId: string, branchId: string) {
    return this.documentsService.getSignedUrl(documentId, selectedBranchScope([branchId]));
  }

  async getStudentCalendar(
    student: { id: string; branchId: string; programId: string | null; batchId: string | null },
    month?: string,
  ) {
    const monthKey = month ?? new Date().toISOString().slice(0, 7);
    const [year, mon] = monthKey.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59);

    const [notices, homework, assessmentRecords] = await Promise.all([
      this.prisma.notice.findMany({
        where: {
          isPublished: true,
          audience: { in: ['all', 'students'] },
          branchId: student.branchId,
          publishedAt: { gte: start, lte: end },
        },
      }),
      this.learningService.listForStudentContext({
        branchId: student.branchId,
        programId: student.programId,
        batchId: student.batchId,
        audience: 'students',
        type: 'homework',
        limit: 100,
      }),
      this.prisma.assessmentRecord.findMany({
        where: { studentId: student.id },
        include: { assessment: { select: { name: true, conductedAt: true } } },
      }),
    ]);

    const events: Array<{ date: string; title: string; type: 'notice' | 'homework' | 'assessment'; href?: string }> =
      [];

    for (const n of notices) {
      if (!n.publishedAt) continue;
      events.push({
        date: n.publishedAt.toISOString().slice(0, 10),
        title: n.title,
        type: 'notice',
        href: '/portal/student/notices',
      });
    }

    for (const hw of homework.data) {
      if (!hw.dueAt) continue;
      const due = new Date(hw.dueAt);
      if (due < start || due > end) continue;
      events.push({
        date: due.toISOString().slice(0, 10),
        title: hw.title,
        type: 'homework',
        href: `/portal/student/learning/${hw.id}`,
      });
    }

    for (const rec of assessmentRecords) {
      const conducted = rec.assessment.conductedAt;
      if (!conducted || conducted < start || conducted > end) continue;
      events.push({
        date: conducted.toISOString().slice(0, 10),
        title: rec.assessment.name,
        type: 'assessment',
        href: '/portal/student/assessments',
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return { month: monthKey, events };
  }

  async getParentCalendar(
    student: { id: string; branchId: string; programId: string | null; batchId: string | null },
    month?: string,
  ) {
    const cal = await this.getStudentCalendar(student, month);
    return {
      month: cal.month,
      events: cal.events.map((e) => ({
        ...e,
        href: e.href?.replace('/portal/student/', '/portal/parent/'),
      })),
    };
  }

  async getStudentInsights(student: { id: string; branchId: string }) {
    const summary = await this.aiInsightsService.getStudentSummary(
      student.id,
      selectedBranchScope([student.branchId]),
    );
    return {
      student: summary.student,
      overallPercentage: summary.overallPercentage,
      narrative: summary.narrative,
      recommendations: summary.recommendations,
      subjects: summary.subjects,
    };
  }

  async getStudentProfile(user: AuthUser) {
    const appUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, fullName: true, phone: true, gender: true },
    });
    const student = await this.prisma.student.findFirst({
      where: { email: user.email, deletedAt: null },
      include: { batch: true, program: true },
    });
    return {
      user: {
        id: appUser?.id ?? user.id,
        email: appUser?.email ?? user.email,
        fullName: appUser?.fullName ?? user.fullName,
        phone: appUser?.phone ?? null,
        gender: appUser?.gender ?? null,
        roles: user.roles,
      },
      student: student
        ? {
            id: student.id,
            fullName: student.fullName,
            phone: student.phone,
            email: student.email,
            address: student.address,
            batch: student.batch,
            program: student.program,
          }
        : null,
    };
  }

  async getParentProfile(user: AuthUser) {
    const appUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, fullName: true, phone: true, gender: true },
    });
    const parent = await this.prisma.parent.findFirst({
      where: { email: user.email, deletedAt: null },
      include: {
        studentParents: {
          include: { student: { select: { id: true, fullName: true } } },
        },
      },
    });
    return {
      user: {
        id: appUser?.id ?? user.id,
        email: appUser?.email ?? user.email,
        fullName: appUser?.fullName ?? user.fullName,
        phone: appUser?.phone ?? null,
        gender: appUser?.gender ?? null,
        roles: user.roles,
      },
      parent: parent
        ? {
            id: parent.id,
            fullName: parent.fullName,
            phone: parent.phone,
            email: parent.email,
            address: parent.address,
          }
        : null,
      children:
        parent?.studentParents.map((sp) => ({
          id: sp.student.id,
          fullName: sp.student.fullName,
          relationshipCode: sp.relationshipCode,
        })) ?? [],
    };
  }

  async listParentLeaveRequests(
    parentEmail: string,
    studentId?: string,
    query?: Pick<PortalSectionQuery, 'page' | 'limit'>,
  ) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 8;
    const parent = await this.prisma.parent.findFirst({
      where: { email: parentEmail, deletedAt: null },
    });
    if (!parent) return paginatedResult([], 0, page, limit);

    const where = {
      kind: 'student' as const,
      parentId: parent.id,
      ...(studentId ? { studentId } : {}),
    };

    const [total, requests] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { student: { select: { fullName: true } } },
      }),
    ]);

    return paginatedResult(
      requests.map((r) => this.toLeaveRequestResponse(r)),
      total,
      page,
      limit,
    );
  }

  async createParentLeaveRequest(parentEmail: string, input: CreateLeaveRequestInput) {
    const parent = await this.prisma.parent.findFirst({
      where: { email: parentEmail, deletedAt: null },
      include: {
        studentParents: { where: { studentId: input.studentId } },
      },
    });
    if (!parent || parent.studentParents.length === 0) {
      throw new ForbiddenException('Student not linked to your parent profile');
    }

    const fromDate = new Date(input.fromDate);
    const toDate = new Date(input.toDate);

    const request = await this.prisma.leaveRequest.create({
      data: {
        kind: 'student',
        studentId: input.studentId,
        parentId: parent.id,
        fromDate,
        toDate,
        reason: input.reason,
        status: 'pending',
      },
      include: { student: { select: { fullName: true } } },
    });

    return this.toLeaveRequestResponse(request);
  }

  async listStaffLeaveRequests(
    scope: BranchScope,
    kind?: string,
    page = 1,
    limit = 8,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const branchFilter = prismaBranchFilter(scope);
    const where = {
      ...(kind ? { kind } : {}),
      ...(scope.kind === 'selected'
        ? {
            OR: [
              { kind: 'student', student: { ...branchFilter } },
              { kind: 'employee', user: { ...branchFilter } },
              { kind: 'employee', userId: { not: null }, user: { branchId: null } },
            ],
          }
        : {}),
    };

    const [requests, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: { select: { fullName: true, branchId: true } },
          user: { select: { fullName: true, branchId: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => this.toLeaveRequestResponse(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createEmployeeLeaveRequest(userId: string, input: CreateEmployeeLeaveRequestInput) {
    const fromDate = new Date(input.fromDate);
    const toDate = new Date(input.toDate);

    const request = await this.prisma.leaveRequest.create({
      data: {
        kind: 'employee',
        userId,
        fromDate,
        toDate,
        reason: input.reason,
        status: 'pending',
      },
      include: { user: { select: { fullName: true } } },
    });

    return this.toLeaveRequestResponse(request);
  }

  async listMyEmployeeLeaveRequests(userId: string, page = 1, limit = 8): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = { kind: 'employee', userId };
    const [requests, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { fullName: true } } },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => this.toLeaveRequestResponse(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async reviewLeaveRequest(id: string, status: 'approved' | 'rejected', reviewerId: string) {
    const existing = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        student: { select: { fullName: true } },
        user: { select: { fullName: true } },
      },
    });
    if (!existing) throw new NotFoundException('Leave request not found');
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status, reviewedById: reviewerId },
      include: {
        student: { select: { fullName: true } },
        user: { select: { fullName: true } },
      },
    });
    return this.toLeaveRequestResponse(updated);
  }

  private toLeaveRequestResponse(r: {
    id: string;
    kind: string;
    studentId: string | null;
    userId: string | null;
    parentId: string | null;
    fromDate: Date;
    toDate: Date;
    reason: string;
    status: string;
    createdAt: Date;
    attachmentFileName?: string | null;
    attachmentStoragePath?: string | null;
    attachmentMimeType?: string | null;
    attachmentSizeBytes?: number | null;
    student?: { fullName: string } | null;
    user?: { fullName: string } | null;
  }) {
    return {
      id: r.id,
      kind: r.kind,
      studentId: r.studentId,
      studentName: r.student?.fullName ?? null,
      employeeId: r.userId,
      employeeName: r.user?.fullName ?? null,
      parentId: r.parentId,
      fromDate: r.fromDate.toISOString().slice(0, 10),
      toDate: r.toDate.toISOString().slice(0, 10),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      attachmentFileName: r.attachmentFileName ?? null,
      attachmentStoragePath: r.attachmentStoragePath ?? null,
      attachmentMimeType: r.attachmentMimeType ?? null,
      attachmentSizeBytes: r.attachmentSizeBytes ?? null,
    };
  }

  private async getLeaveRequestForAccess(
    id: string,
    access: { userId?: string; parentEmail?: string; staff?: boolean },
  ) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');

    if (access.staff) return request;

    if (access.userId && request.kind === 'employee' && request.userId === access.userId) {
      return request;
    }

    if (access.parentEmail && request.kind === 'student') {
      const parent = await this.prisma.parent.findFirst({
        where: { email: access.parentEmail, deletedAt: null },
      });
      if (parent && request.parentId === parent.id) return request;
    }

    throw new ForbiddenException('You cannot access this leave request');
  }

  async prepareLeaveAttachmentUpload(
    id: string,
    input: PrepareLeaveAttachmentUploadInput,
    access: { userId?: string; parentEmail?: string; staff?: boolean },
  ) {
    const request = await this.getLeaveRequestForAccess(id, access);
    if (!this.supabaseAdmin) {
      throw new BadRequestException(
        'File uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    await this.ensureLeaveBucket();

    const path = `${request.kind}/${request.id}/${Date.now()}-${this.safeStorageFileName(input.fileName)}`;
    const { data, error } = await this.supabaseAdmin.storage
      .from(LEAVE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Could not prepare file upload');
    }
    return {
      bucket: LEAVE_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  async setLeaveAttachment(
    id: string,
    input: LeaveAttachmentMetaInput,
    access: { userId?: string; parentEmail?: string; staff?: boolean },
  ) {
    await this.getLeaveRequestForAccess(id, access);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        attachmentFileName: input.fileName,
        attachmentStoragePath: input.storagePath,
        attachmentMimeType: input.mimeType ?? null,
        attachmentSizeBytes: input.sizeBytes ?? null,
      },
      include: {
        student: { select: { fullName: true } },
        user: { select: { fullName: true } },
      },
    });
    return this.toLeaveRequestResponse(updated);
  }

  async getLeaveAttachmentSignedUrl(
    id: string,
    access: { userId?: string; parentEmail?: string; staff?: boolean },
  ) {
    const request = await this.getLeaveRequestForAccess(id, access);
    if (!request.attachmentStoragePath || !request.attachmentFileName) {
      throw new NotFoundException('No attachment on this leave request');
    }
    if (!this.supabaseAdmin) {
      return { url: request.attachmentStoragePath, signed: false, fileName: request.attachmentFileName };
    }

    const objectKey = request.attachmentStoragePath.replace(/^leave-attachments\//, '');
    const { data, error } = await this.supabaseAdmin.storage
      .from(LEAVE_BUCKET)
      .createSignedUrl(objectKey, 3600);
    if (error || !data) {
      throw new NotFoundException(
        'This file is no longer available in storage. It may not have been uploaded in this environment.',
      );
    }
    return { url: data.signedUrl, signed: true, fileName: request.attachmentFileName };
  }

  private async fetchTimetableSlots(batchId: string, branchId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: { batchId, branchId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const subjectIds = [...new Set(slots.map((s) => s.subjectId))];
    const teacherIds = [...new Set(slots.map((s) => s.teacherId).filter((id): id is string => !!id))];
    const [subjects, teachers] = await Promise.all([
      subjectIds.length
        ? this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
        : [],
      teacherIds.length
        ? this.prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } })
        : [],
    ]);
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t.fullName]));
    return slots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      subjectName: subjectMap.get(slot.subjectId) ?? null,
      teacherName: slot.teacherId ? (teacherMap.get(slot.teacherId) ?? null) : null,
    }));
  }
}
