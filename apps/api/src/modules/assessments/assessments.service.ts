import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import { allBranchScope, selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import { paginatedResult } from '../../common/utils/pagination.util';
import { calculateGrade, calculatePercentage } from '@eims/shared';
import type { AssessmentsStatsResponse, AuthUser, PaginatedResponse } from '@eims/types';
import type {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  ListAssessmentsQuery,
  ListAssessmentTypesQuery,
  ListAssessmentSeriesQuery,
  MarksSheetQuery,
  BulkMarksInput,
  ReportCardsQuery,
  CreateAssessmentTypeInput,
  UpdateAssessmentTypeInput,
  CreateAssessmentSeriesInput,
  UpdateAssessmentSeriesInput,
} from '@eims/shared';
import type { Assessment, AssessmentType } from '@prisma/client';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(scope: BranchScope): Promise<AssessmentsStatsResponse> {
    const cacheKey = `assessments:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<AssessmentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const thirtyAgo = thirtyDaysAgo();
    const now = new Date();

    const [active, activePrev, completed, completedPrev, marksAgg, pendingMarks] =
      await Promise.all([
        this.prisma.assessment.count({
          where: { ...branchFilter, conductedAt: { gte: now } },
        }),
        this.prisma.assessment.count({
          where: { ...branchFilter, conductedAt: { gte: thirtyAgo, lt: now } },
        }),
        this.prisma.assessment.count({
          where: { ...branchFilter, conductedAt: { lt: now } },
        }),
        this.prisma.assessment.count({
          where: { ...branchFilter, conductedAt: { lt: thirtyAgo } },
        }),
        this.prisma.assessmentRecord.aggregate({ _avg: { percentage: true } }),
        this.prisma.assessmentRecord.count({ where: { obtainedMarks: null } }),
      ]);

    const avgScore = Math.round(Number(marksAgg._avg.percentage ?? 0));

    const result: AssessmentsStatsResponse = {
      activeAssessments: countWithTrend(active, activePrev),
      completedAssessments: countWithTrend(completed, completedPrev),
      averageScore: countWithTrend(avgScore, avgScore),
      pendingMarks: countWithTrend(pendingMarks, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async listTypes(query: ListAssessmentTypesQuery): Promise<PaginatedResponse<AssessmentType>> {
    const includeInactive = query.all === true;
    const where = includeInactive ? {} : { isActive: true };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [types, total] = await Promise.all([
      this.prisma.assessmentType.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assessmentType.count({ where }),
    ]);
    return paginatedResult(types, total, page, limit);
  }

  async createType(input: CreateAssessmentTypeInput, user: AuthUser) {
    const existing = await this.prisma.assessmentType.findUnique({ where: { code: input.code } });
    if (existing) throw new BadRequestException('Assessment type code already exists');

    const type = await this.prisma.assessmentType.create({
      data: { name: input.name, code: input.code },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment_type.created',
      entityType: 'AssessmentType',
      entityId: type.id,
      newValue: type,
    });

    return type;
  }

  async updateType(id: string, input: UpdateAssessmentTypeInput, user: AuthUser) {
    const existing = await this.prisma.assessmentType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assessment type not found');

    const type = await this.prisma.assessmentType.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment_type.updated',
      entityType: 'AssessmentType',
      entityId: type.id,
      previousValue: existing,
      newValue: type,
    });

    return type;
  }

  async listSeries(query: ListAssessmentSeriesQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [series, total] = await Promise.all([
      this.prisma.assessmentSeries.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assessmentSeries.count(),
    ]);
    return paginatedResult(series, total, page, limit);
  }

  async createSeries(input: CreateAssessmentSeriesInput, user: AuthUser) {
    const existing = await this.prisma.assessmentSeries.findUnique({ where: { code: input.code } });
    if (existing) throw new BadRequestException('Series code already exists');

    const series = await this.prisma.assessmentSeries.create({
      data: { name: input.name, code: input.code },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment_series.created',
      entityType: 'AssessmentSeries',
      entityId: series.id,
      newValue: series,
    });

    return series;
  }

  async updateSeries(id: string, input: UpdateAssessmentSeriesInput, user: AuthUser) {
    const existing = await this.prisma.assessmentSeries.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assessment series not found');

    const series = await this.prisma.assessmentSeries.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment_series.updated',
      entityType: 'AssessmentSeries',
      entityId: series.id,
      previousValue: existing,
      newValue: series,
    });

    return series;
  }

  private mapAssessment(assessment: Assessment, type: AssessmentType | null = null) {
    return {
      id: assessment.id,
      branchId: assessment.branchId,
      name: assessment.name,
      typeId: assessment.typeId,
      type,
      seriesId: assessment.seriesId,
      sessionId: assessment.sessionId,
      totalMarks: Number(assessment.totalMarks),
      conductedAt: assessment.conductedAt?.toISOString() ?? null,
      status: assessment.status,
      publishedAt: assessment.publishedAt?.toISOString() ?? null,
      publishedById: assessment.publishedById,
      answerKey: assessment.answerKey,
      reviewNotes: assessment.reviewNotes,
      createdAt: assessment.createdAt.toISOString(),
    };
  }

  async findAll(query: ListAssessmentsQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      ...prismaBranchFilter(effective),
      ...(query.typeId ? { typeId: query.typeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.publishedOnly ? { status: 'published' as const } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [assessments, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        orderBy: { conductedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assessment.count({ where }),
    ]);

    const typeIds = [...new Set(assessments.map((a) => a.typeId))];
    const types = typeIds.length
      ? await this.prisma.assessmentType.findMany({ where: { id: { in: typeIds } } })
      : [];
    const typeMap = new Map(types.map((t) => [t.id, t]));

    return paginatedResult(
      assessments.map((a) => this.mapAssessment(a, typeMap.get(a.typeId) ?? null)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, scope: BranchScope) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const type = await this.prisma.assessmentType.findUnique({ where: { id: assessment.typeId } });
    return this.mapAssessment(assessment, type);
  }

  async create(input: CreateAssessmentInput, user: AuthUser) {
    const type = await this.prisma.assessmentType.findUnique({ where: { id: input.typeId } });
    if (!type) throw new BadRequestException('Invalid assessment type');

    const assessment = await this.prisma.assessment.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        typeId: input.typeId,
        seriesId: input.seriesId,
        sessionId: input.sessionId,
        totalMarks: input.totalMarks,
        conductedAt: input.conductedAt ? new Date(input.conductedAt) : null,
        answerKey: input.answerKey,
        reviewNotes: input.reviewNotes,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.created',
      entityType: 'Assessment',
      entityId: assessment.id,
      newValue: assessment,
    });

    return this.findOne(assessment.id, allBranchScope());
  }

  async update(id: string, input: UpdateAssessmentInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status === 'published') {
      throw new BadRequestException('Cannot edit a published assessment');
    }

    if (input.typeId) {
      const type = await this.prisma.assessmentType.findUnique({ where: { id: input.typeId } });
      if (!type) throw new BadRequestException('Invalid assessment type');
    }

    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.typeId !== undefined ? { typeId: input.typeId } : {}),
        ...(input.seriesId !== undefined ? { seriesId: input.seriesId } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.totalMarks !== undefined ? { totalMarks: input.totalMarks } : {}),
        ...(input.conductedAt !== undefined
          ? { conductedAt: input.conductedAt ? new Date(input.conductedAt) : null }
          : {}),
        ...(input.answerKey !== undefined ? { answerKey: input.answerKey } : {}),
        ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.updated',
      entityType: 'Assessment',
      entityId: assessment.id,
      previousValue: existing,
      newValue: assessment,
    });

    return this.findOne(assessment.id, scope);
  }

  async submitReview(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft assessments can be submitted for review');
    }

    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: 'in_review' },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.submitted_for_review',
      entityType: 'Assessment',
      entityId: assessment.id,
      previousValue: existing,
      newValue: assessment,
    });

    return this.findOne(assessment.id, scope);
  }

  async publish(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status !== 'draft' && existing.status !== 'in_review') {
      throw new BadRequestException('Only draft or in-review assessments can be published');
    }

    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishedById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.published',
      entityType: 'Assessment',
      entityId: assessment.id,
      previousValue: existing,
      newValue: assessment,
    });

    return this.findOne(assessment.id, scope);
  }

  async unpublish(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status !== 'published') {
      throw new BadRequestException('Only published assessments can be unpublished');
    }

    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        status: 'draft',
        publishedAt: null,
        publishedById: null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.unpublished',
      entityType: 'Assessment',
      entityId: assessment.id,
      previousValue: existing,
      newValue: assessment,
    });

    return this.findOne(assessment.id, scope);
  }

  async getMarksSheet(id: string, query: MarksSheetQuery, scope: BranchScope) {
    const assessment = await this.findOne(id, scope);
    const batch = await this.prisma.batch.findFirst({
      where: { id: query.batchId, branchId: assessment.branchId, deletedAt: null },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const [students, subjects, records] = await Promise.all([
      this.prisma.student.findMany({
        where: { batchId: query.batchId, branchId: assessment.branchId, deletedAt: null },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true },
      }),
      this.prisma.subject.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.assessmentRecord.findMany({
        where: { assessmentId: id, student: { batchId: query.batchId } },
      }),
    ]);

    const recordMap = new Map(
      records.map((r) => [`${r.studentId}:${r.subjectId}`, r]),
    );

    return {
      assessment,
      batchId: query.batchId,
      batchName: batch.name,
      subjects,
      students: students.map((student) => ({
        studentId: student.id,
        fullName: student.fullName,
        marks: subjects.map((subject) => {
          const record = recordMap.get(`${student.id}:${subject.id}`);
          return {
            subjectId: subject.id,
            subjectName: subject.name,
            record: record
              ? {
                  id: record.id,
                  obtainedMarks: record.obtainedMarks ? Number(record.obtainedMarks) : null,
                  percentage: record.percentage ? Number(record.percentage) : null,
                  grade: record.grade,
                  rank: record.rank,
                  remarks: record.remarks,
                }
              : null,
          };
        }),
      })),
    };
  }

  async exportMarksCsv(id: string, query: MarksSheetQuery, scope: BranchScope) {
    const sheet = await this.getMarksSheet(id, query, scope);
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'Student',
      ...sheet.subjects.flatMap((s) => [
        `${s.name} Marks`,
        `${s.name} %`,
        `${s.name} Grade`,
        `${s.name} Rank`,
      ]),
    ];

    const rows = sheet.students.map((student) => {
      const cells = [escape(student.fullName)];
      for (const mark of student.marks) {
        cells.push(
          escape(mark.record?.obtainedMarks),
          escape(mark.record?.percentage),
          escape(mark.record?.grade),
          escape(mark.record?.rank),
        );
      }
      return cells.join(',');
    });

    const csv = [header.map(escape).join(','), ...rows].join('\n');
    const filename = `${sheet.assessment.name.replace(/[^\w.-]+/g, '_')}_${sheet.batchName.replace(/[^\w.-]+/g, '_')}_results.csv`;
    return { csv, filename };
  }

  async bulkMarks(id: string, input: BulkMarksInput, user: AuthUser, scope: BranchScope) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status === 'published') {
      throw new BadRequestException('Cannot modify marks on a published assessment');
    }

    const totalMarks = Number(assessment.totalMarks);
    const studentIds = [...new Set(input.records.map((r) => r.studentId))];

    const validStudents = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        batchId: input.batchId,
        branchId: assessment.branchId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (validStudents.length !== studentIds.length) {
      throw new BadRequestException('Invalid students for this batch');
    }

    await this.prisma.$transaction(
      input.records.map((record) => {
        const percentage = calculatePercentage(record.obtainedMarks, totalMarks);
        const grade = calculateGrade(percentage);
        return this.prisma.assessmentRecord.upsert({
          where: {
            assessmentId_studentId_subjectId: {
              assessmentId: id,
              studentId: record.studentId,
              subjectId: record.subjectId,
            },
          },
          create: {
            assessmentId: id,
            studentId: record.studentId,
            subjectId: record.subjectId,
            obtainedMarks: record.obtainedMarks,
            percentage,
            grade,
            remarks: record.remarks,
            createdById: user.id,
          },
          update: {
            obtainedMarks: record.obtainedMarks,
            percentage,
            grade,
            remarks: record.remarks,
            createdById: user.id,
          },
        });
      }),
    );

    const subjectIds = [...new Set(input.records.map((r) => r.subjectId))];
    for (const subjectId of subjectIds) {
      await this.recalculateRanks(id, subjectId);
    }

    await this.audit.log({
      userId: user.id,
      action: 'assessment.marks_entered',
      entityType: 'Assessment',
      entityId: id,
      newValue: { count: input.records.length, batchId: input.batchId },
    });

    return { assessmentId: id, marked: input.records.length };
  }

  private async recalculateRanks(assessmentId: string, subjectId: string) {
    const records = await this.prisma.assessmentRecord.findMany({
      where: { assessmentId, subjectId, obtainedMarks: { not: null } },
      orderBy: { obtainedMarks: 'desc' },
    });

    await this.prisma.$transaction(
      records.map((record, index) =>
        this.prisma.assessmentRecord.update({
          where: { id: record.id },
          data: { rank: index + 1 },
        }),
      ),
    );
  }

  async getStudentRecords(
    studentId: string,
    scope: BranchScope,
    publishedOnly = false,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const records = await this.prisma.assessmentRecord.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      ...(publishedOnly ? {} : { take: 20 }),
    });

    const assessmentIds = [...new Set(records.map((r) => r.assessmentId))];
    const subjectIds = [...new Set(records.map((r) => r.subjectId))];

    const [assessments, subjects] = await Promise.all([
      this.prisma.assessment.findMany({
        where: {
          id: { in: assessmentIds },
          ...(publishedOnly ? { status: 'published' } : {}),
        },
      }),
      this.prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
    ]);

    const assessmentMap = new Map(assessments.map((a) => [a.id, a]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const filteredRecords = publishedOnly
      ? records.filter((r) => assessmentMap.has(r.assessmentId))
      : records;

    return {
      studentId,
      studentName: student.fullName,
      records: filteredRecords.map((r) => ({
        id: r.id,
        assessment: assessmentMap.get(r.assessmentId)?.name ?? null,
        subject: subjectMap.get(r.subjectId)?.name ?? null,
        obtainedMarks: r.obtainedMarks ? Number(r.obtainedMarks) : null,
        percentage: r.percentage ? Number(r.percentage) : null,
        grade: r.grade,
        rank: r.rank,
        remarks: r.remarks,
      })),
    };
  }

  async getReportCard(query: ReportCardsQuery, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: query.studentId,
        deletedAt: null,
        ...prismaBranchFilter(scope),
      },
      include: {
        batch: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const records = await this.prisma.assessmentRecord.findMany({
      where: {
        studentId: query.studentId,
        assessment: {
          status: 'published',
          branchId: student.branchId,
          ...(query.assessmentId ? { id: query.assessmentId } : {}),
        },
      },
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

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        batch: student.batch,
        program: student.program,
      },
      records: records.map((r) => {
        const assessment = assessmentMap.get(r.assessmentId);
        return {
          id: r.id,
          assessmentId: r.assessmentId,
          assessmentName: assessment?.name ?? null,
          assessmentType: assessment?.typeId ?? null,
          totalMarks: assessment ? Number(assessment.totalMarks) : null,
          subject: subjectMap.get(r.subjectId)?.name ?? null,
          obtainedMarks: r.obtainedMarks ? Number(r.obtainedMarks) : null,
          percentage: r.percentage ? Number(r.percentage) : null,
          grade: r.grade,
          rank: r.rank,
          remarks: r.remarks,
          publishedAt: assessment?.publishedAt?.toISOString() ?? null,
        };
      }),
    };
  }
}
