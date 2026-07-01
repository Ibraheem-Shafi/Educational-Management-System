import type { PrismaClient } from '@prisma/client';
import type { DemoConfig } from './types';

export async function cleanupDemoData(prisma: PrismaClient, config: DemoConfig): Promise<void> {
  const demoEmails = config.accounts.map((a) => a.email);
  const batchCodes = config.batches.map((b) => b.code);
  const demoKeys = config.students.map((s) => s.demoKey);
  const parentCnic = config.parents.map((p) => p.cnic);

  const demoStudents = await prisma.student.findMany({
    where: {
      OR: [
        ...demoKeys.map((key) => ({
          customFields: { path: ['_demoKey'], equals: key },
        })),
        { cnicOrBForm: { in: config.students.map((s) => s.cnic) } },
      ],
    },
    select: { id: true },
  });
  const studentIds = demoStudents.map((s) => s.id);

  const demoBatches = await prisma.batch.findMany({
    where: { code: { in: batchCodes } },
    select: { id: true },
  });
  const batchIds = demoBatches.map((b) => b.id);

  if (studentIds.length) {
    await prisma.assessmentRecord.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.attendanceRecord.deleteMany({ where: { entityId: { in: studentIds } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentParent.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentSubject.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.document.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  }

  if (parentCnic.length) {
    await prisma.parent.deleteMany({ where: { cnic: { in: parentCnic } } });
  }

  if (batchIds.length) {
    await prisma.timetableSlot.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batchSubject.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batch.deleteMany({ where: { id: { in: batchIds } } });
  }

  await prisma.assessment.deleteMany({
    where: { name: { in: config.assessments.map((a) => a.name) } },
  });
  await prisma.feeStructure.deleteMany({
    where: {
      feeTypeId: {
        in: (
          await prisma.feeType.findMany({
            where: { code: { in: config.feeStructures.map((f) => f.feeTypeCode) } },
            select: { id: true },
          })
        ).map((f) => f.id),
      },
    },
  });
  await prisma.notice.deleteMany({
    where: { title: { in: config.notices.map((n) => n.title) } },
  });
  await prisma.document.deleteMany({
    where: { title: { in: config.documents.map((d) => d.title) } },
  });
  await prisma.communicationLog.deleteMany({});

  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true },
  });
  const userIds = demoUsers.map((u) => u.id);
  if (userIds.length) {
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
