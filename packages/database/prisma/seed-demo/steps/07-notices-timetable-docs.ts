import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

export async function seedNoticesTimetableDocs(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

  for (const n of ctx.config.notices) {
    const branchId = ctx.branchMap.get(n.branchCode)!;
    const existing = await prisma.notice.findFirst({
      where: { branchId, title: n.title },
    });
    if (existing) continue;

    const publishedAt = n.published ? new Date() : null;
    if (publishedAt) publishedAt.setDate(publishedAt.getDate() - n.daysAgo);

    await prisma.notice.create({
      data: {
        branchId,
        title: n.title,
        body: n.body,
        audience: n.audience,
        isPublished: n.published,
        publishedAt,
        createdById: adminId,
      },
    });
  }

  for (const slot of ctx.config.timetable) {
    const branchId = ctx.branchMap.get(slot.branchCode)!;
    const batchId = ctx.batchMap.get(slot.batchCode)!;
    const subjectId = ctx.subjectMap.get(slot.subjectCode)!;
    const teacherId = slot.teacherEmail ? ctx.userIds.get(slot.teacherEmail) : null;

    const existing = await prisma.timetableSlot.findFirst({
      where: { batchId, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, subjectId },
    });
    if (existing) continue;

    await prisma.timetableSlot.create({
      data: {
        branchId,
        batchId,
        subjectId,
        teacherId: teacherId ?? null,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room ?? null,
      },
    });
  }

  for (const doc of ctx.config.documents) {
    const branchId = ctx.branchMap.get(doc.branchCode)!;
    const studentId = doc.studentDemoKey ? ctx.studentIds.get(doc.studentDemoKey) : null;

    const existing = await prisma.document.findFirst({
      where: { branchId, title: doc.title, deletedAt: null },
    });
    if (existing) continue;

    await prisma.document.create({
      data: {
        branchId,
        studentId: studentId ?? null,
        category: doc.category,
        title: doc.title,
        storagePath: doc.storagePath,
        mimeType: doc.mimeType ?? null,
        sizeBytes: doc.sizeBytes ?? null,
        uploadedById: adminId,
      },
    });
  }
}
