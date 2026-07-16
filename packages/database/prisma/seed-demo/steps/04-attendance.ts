import type { PrismaClient } from '@prisma/client';
import { chunkArray } from '../utils';
import { buildAttendanceRecords } from '../generators/attendance';
import type { DemoContext } from '../types';

export async function seedAttendance(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const activeStatusId = ctx.statusIds.student.active;
  const demoStudentIds = [...ctx.studentIds.values()];

  const students = await prisma.student.findMany({
    where: {
      id: { in: demoStudentIds },
      statusId: activeStatusId,
      deletedAt: null,
    },
    select: { id: true, branchId: true, customFields: true },
  });

  const mapped = students.map((s) => ({
    id: s.id,
    branchId: s.branchId,
    demoKey: (s.customFields as { _demoKey?: string })._demoKey ?? s.id,
  }));

  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;
  const records = buildAttendanceRecords(mapped, ctx.statusIds.attendance, adminId);

  for (const chunk of chunkArray(records, 250)) {
    await prisma.attendanceRecord.createMany({ data: chunk, skipDuplicates: true });
  }
}
