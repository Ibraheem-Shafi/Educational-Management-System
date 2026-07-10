import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AttendanceService } from '../attendance/attendance.service';
import { FeesService } from '../fees/fees.service';
import { LearningService } from '../learning/learning.service';
import { DocumentsService } from '../documents/documents.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import type { AuthUser, PaginatedResponse } from '@eims/types';
import type { CreateLeaveRequestInput, PortalSectionQuery } from '@eims/shared';

function paginate<T>(items: T[], page = 1, limit = 20): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: { total, page: safePage, limit, totalPages },
  };
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
export class PortalSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly feesService: FeesService,
    private readonly learningService: LearningService,
    private readonly documentsService: DocumentsService,
    private readonly aiInsightsService: AiInsightsService,
  ) {}

  async getStudentAttendance(
    student: { id: string; branchId: string },
    query: PortalSectionQuery,
  ) {
    const range = defaultDateRange(query.from, query.to);
    const history = await this.attendanceService.getHistory(
      { studentId: student.id, from: range.from, to: range.to },
      student.branchId,
    );
    const summary = attendanceSummary(history.records);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return {
      summary,
      records: paginate(history.records, page, limit),
    };
  }

  async getStudentAssessments(
    student: { id: string; branchId: string },
    query: PortalSectionQuery,
  ) {
    const records = await this.prisma.assessmentRecord.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    const assessmentIds = [...new Set(records.map((r) => r.assessmentId))];
    const subjectIds = [...new Set(records.map((r) => r.subjectId))];
    const [assessments, subjects] = await Promise.all([
      this.prisma.assessment.findMany({ where: { id: { in: assessmentIds } } }),
      this.prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
    ]);
    const assessmentMap = new Map(assessments.map((a) => [a.id, a]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const mapped = records.map((r) => ({
      id: r.id,
      assessment: assessmentMap.get(r.assessmentId)?.name ?? null,
      subject: subjectMap.get(r.subjectId)?.name ?? null,
      grade: r.grade,
      percentage: r.percentage ? Number(r.percentage) : null,
    }));

    const percentages = mapped.map((r) => r.percentage).filter((p): p is number => p !== null);
    const averagePercentage =
      percentages.length > 0
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
        : null;

    const subjectAgg = new Map<string, { sum: number; count: number }>();
    for (const row of mapped) {
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

    return {
      averagePercentage,
      bySubject,
      records: paginate(mapped, query.page ?? 1, query.limit ?? 20),
    };
  }

  async getStudentFees(student: { id: string; branchId: string }, query: PortalSectionQuery) {
    const fees = await this.feesService.getStudentFees(student.id, student.branchId);
    return {
      outstanding: fees.outstanding,
      invoices: paginate(fees.invoices, query.page ?? 1, query.limit ?? 20),
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

  async getStudentNotices(user: AuthUser, branchId: string | null, query: PortalSectionQuery) {
    const audiences: string[] = ['all', 'students'];
    const where = {
      isPublished: true,
      audience: { in: audiences },
      ...(branchId ? { branchId } : {}),
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
    const limit = query.limit ?? 20;
    const [total, notices] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        audience: n.audience,
        publishedAt: n.publishedAt?.toISOString() ?? null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getParentNotices(user: AuthUser, branchId: string | null, query: PortalSectionQuery) {
    const audiences: string[] = ['all', 'parents'];
    const where = {
      isPublished: true,
      audience: { in: audiences },
      ...(branchId ? { branchId } : {}),
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
    const limit = query.limit ?? 20;
    const [total, notices] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        audience: n.audience,
        publishedAt: n.publishedAt?.toISOString() ?? null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getStudentDocuments(student: { id: string; branchId: string }, query: PortalSectionQuery) {
    const result = await this.documentsService.findAll({ studentId: student.id }, student.branchId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const mapped = result.data.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt.toISOString(),
    }));
    return paginate(mapped, page, limit);
  }

  async getDocumentSignedUrl(documentId: string, branchId: string) {
    return this.documentsService.getSignedUrl(documentId, branchId);
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
    const summary = await this.aiInsightsService.getStudentSummary(student.id, student.branchId);
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

  async listParentLeaveRequests(parentEmail: string, studentId?: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { email: parentEmail, deletedAt: null },
    });
    if (!parent) return { data: [] };

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        parentId: parent.id,
        ...(studentId ? { studentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { fullName: true } } },
    });

    return {
      data: requests.map((r: (typeof requests)[number]) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.fullName,
        parentId: r.parentId,
        fromDate: r.fromDate.toISOString().slice(0, 10),
        toDate: r.toDate.toISOString().slice(0, 10),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
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
    if (toDate < fromDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        studentId: input.studentId,
        parentId: parent.id,
        fromDate,
        toDate,
        reason: input.reason,
        status: 'pending',
      },
      include: { student: { select: { fullName: true } } },
    });

    return {
      id: request.id,
      studentId: request.studentId,
      studentName: request.student.fullName,
      parentId: request.parentId,
      fromDate: request.fromDate.toISOString().slice(0, 10),
      toDate: request.toDate.toISOString().slice(0, 10),
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    };
  }

  async listStaffLeaveRequests(branchId: string | null) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: branchId
        ? { student: { branchId } }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { student: { select: { fullName: true, branchId: true } } },
    });
    return {
      data: requests.map((r: (typeof requests)[number]) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.fullName,
        parentId: r.parentId,
        fromDate: r.fromDate.toISOString().slice(0, 10),
        toDate: r.toDate.toISOString().slice(0, 10),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async reviewLeaveRequest(id: string, status: 'approved' | 'rejected', reviewerId: string) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Leave request not found');
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status, reviewedById: reviewerId },
      include: { student: { select: { fullName: true } } },
    });
    return {
      id: updated.id,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      parentId: updated.parentId,
      fromDate: updated.fromDate.toISOString().slice(0, 10),
      toDate: updated.toDate.toISOString().slice(0, 10),
      reason: updated.reason,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
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
