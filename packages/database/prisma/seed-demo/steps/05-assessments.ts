import type { PrismaClient } from '@prisma/client';
import { buildAssessmentRecords } from '../generators/marks';
import type { DemoContext } from '../types';

export async function seedAssessments(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

  for (const spec of ctx.config.assessments) {
    const branchId = ctx.branchMap.get(spec.branchCode)!;
    const conductedAt = new Date();
    conductedAt.setDate(conductedAt.getDate() - spec.daysAgo);

    let assessment = await prisma.assessment.findFirst({
      where: { branchId, name: spec.name },
    });
    if (!assessment) {
      assessment = await prisma.assessment.create({
        data: {
          branchId,
          name: spec.name,
          typeId: ctx.assessmentTypeMap.get(spec.typeCode)!,
          seriesId: spec.seriesCode ? ctx.seriesMap.get(spec.seriesCode) : null,
          sessionId: ctx.sessionId,
          totalMarks: spec.totalMarks,
          conductedAt,
          status: 'published',
          publishedAt: conductedAt,
          publishedById: adminId,
        },
      });
    } else if (assessment.status === 'draft') {
      await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          status: 'published',
          publishedAt: assessment.conductedAt ?? conductedAt,
          publishedById: adminId,
        },
      });
    }

    const batchId = ctx.batchMap.get(spec.batchCode);
    if (!batchId) continue;

    const activeStatusId = ctx.statusIds.student.active;
    const batchStudents = await prisma.student.findMany({
      where: { batchId, deletedAt: null, statusId: activeStatusId },
      orderBy: { fullName: 'asc' },
      select: { id: true, customFields: true },
    });

    const students = batchStudents.map((s) => ({
      id: s.id,
      demoKey: (s.customFields as { _demoKey?: string })._demoKey ?? s.id,
    }));

    const subjectIds = spec.subjectCodes.map((c) => ctx.subjectMap.get(c)!);
    const marksPerSubject = Math.floor(spec.totalMarks / subjectIds.length);

    const records = buildAssessmentRecords(
      spec.demoKey,
      assessment.id,
      students,
      subjectIds,
      marksPerSubject,
      adminId,
    );

    await prisma.assessmentRecord.createMany({ data: records, skipDuplicates: true });
  }
}
