import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { calculateGrade, calculatePercentage } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateAssessmentInput,
  ListAssessmentsQuery,
  MarksSheetQuery,
  BulkMarksInput,
  CreateAssessmentTypeInput,
  UpdateAssessmentTypeInput,
  CreateAssessmentSeriesInput,
  UpdateAssessmentSeriesInput,
} from '@eims/shared';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listTypes(includeInactive = false) {
    const types = await this.prisma.assessmentType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { data: types };
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

  async listSeries() {
    const series = await this.prisma.assessmentSeries.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: series };
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

  async findAll(query: ListAssessmentsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const assessments = await this.prisma.assessment.findMany({
      where: {
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.typeId ? { typeId: query.typeId } : {}),
      },
      orderBy: { conductedAt: 'desc' },
    });

    const typeIds = [...new Set(assessments.map((a) => a.typeId))];
    const types = typeIds.length
      ? await this.prisma.assessmentType.findMany({ where: { id: { in: typeIds } } })
      : [];
    const typeMap = new Map(types.map((t) => [t.id, t]));

    return {
      data: assessments.map((a) => ({
        id: a.id,
        branchId: a.branchId,
        name: a.name,
        typeId: a.typeId,
        type: typeMap.get(a.typeId) ?? null,
        seriesId: a.seriesId,
        sessionId: a.sessionId,
        totalMarks: Number(a.totalMarks),
        conductedAt: a.conductedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async findOne(id: string, branchId: string | null) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const type = await this.prisma.assessmentType.findUnique({ where: { id: assessment.typeId } });
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
      createdAt: assessment.createdAt.toISOString(),
    };
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
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'assessment.created',
      entityType: 'Assessment',
      entityId: assessment.id,
      newValue: assessment,
    });

    return this.findOne(assessment.id, null);
  }

  async getMarksSheet(id: string, query: MarksSheetQuery, branchId: string | null) {
    const assessment = await this.findOne(id, branchId);
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

  async bulkMarks(id: string, input: BulkMarksInput, user: AuthUser, branchId: string | null) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

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

  async getStudentRecords(studentId: string, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!student) throw new NotFoundException('Student not found');

    const records = await this.prisma.assessmentRecord.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
      studentId,
      studentName: student.fullName,
      records: records.map((r) => ({
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
}
