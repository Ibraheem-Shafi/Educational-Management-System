import type { PrismaClient } from '@prisma/client';
import { parseDateOnly } from '../utils';
import type { DemoContext } from '../types';

export async function seedStudentsAndParents(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const parent of ctx.config.parents) {
    const existing = await prisma.parent.findFirst({
      where: { cnic: parent.cnic, deletedAt: null },
    });
    const row =
      existing ??
      (await prisma.parent.create({
        data: {
          fullName: parent.fullName,
          phone: parent.phone,
          email: parent.email ?? null,
          cnic: parent.cnic,
          address: parent.address ?? null,
        },
      }));
    ctx.parentIds.set(parent.demoKey, row.id);
  }

  for (const student of ctx.config.students) {
    const batchId = ctx.batchMap.get(student.batchCode)!;
    const batch = ctx.config.batches.find((b) => b.code === student.batchCode)!;
    const branchId = ctx.branchMap.get(batch.branchCode)!;
    const programId = ctx.programMap.get(`${batch.branchCode}:${batch.programCode}`)!;
    const statusId = ctx.statusIds.student[student.status] ?? ctx.statusIds.student.active;

    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { cnicOrBForm: student.cnic },
          {
            customFields: { path: ['_demoKey'], equals: student.demoKey },
          },
        ],
        deletedAt: null,
      },
    });

    const customFields = { ...student.customFields, _demoKey: student.demoKey };

    const row =
      existing ??
      (await prisma.student.create({
        data: {
          branchId,
          programId,
          batchId,
          fullName: student.fullName,
          dateOfBirth: parseDateOnly(student.dob),
          gender: student.gender,
          cnicOrBForm: student.cnic,
          phone: student.phone,
          email: student.email ?? null,
          address: `${student.address}, ${student.city}`,
          statusId,
          customFields,
        },
      }));

    if (existing) {
      await prisma.student.update({
        where: { id: row.id },
        data: { customFields, batchId, programId, statusId },
      });
    }

    ctx.studentIds.set(student.demoKey, row.id);

    const batchDef = ctx.config.batches.find((b) => b.code === student.batchCode)!;
    for (const sc of batchDef.subjects) {
      const subjectId = ctx.subjectMap.get(sc)!;
      await prisma.studentSubject.upsert({
        where: { studentId_subjectId: { studentId: row.id, subjectId } },
        create: { studentId: row.id, subjectId },
        update: {},
      });
    }
  }

  for (const link of ctx.config.links) {
    const studentId = ctx.studentIds.get(link.studentDemoKey);
    const parentId = ctx.parentIds.get(link.parentDemoKey);
    if (!studentId || !parentId) continue;

    await prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId, parentId } },
      create: { studentId, parentId, relationshipCode: link.relationship },
      update: { relationshipCode: link.relationship },
    });
  }
}
