import type { PrismaClient } from '@prisma/client';
import { recentWeekdays } from '../utils';
import {
  configuredBranchCodes,
  staffEmail,
  staffUserId,
} from '../branch-helpers';
import { buildAttendanceRecords } from '../generators/attendance';
import { chunkArray } from '../utils';
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

  // Staff / teacher attendance for each branch
  const dates = recentWeekdays(10);
  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const staffRoles = ['teacher', 'accountant', 'receptionist'] as const;
    for (const role of staffRoles) {
      const userId = staffUserId(ctx, branchCode, role);
      const email = staffEmail(branchCode, role);
      if (!userId || !email) continue;

      for (const [di, date] of dates.entries()) {
        const roll = (email.length * 7 + di * 13) % 100;
        let code = 'present';
        if (roll >= 85 && roll < 92) code = 'late';
        else if (roll >= 92) code = 'leave';

        await prisma.attendanceRecord.createMany({
          data: [
            {
              branchId,
              entityType: role === 'teacher' ? 'teacher' : 'staff',
              entityId: userId,
              date,
              statusId: ctx.statusIds.attendance[code],
              markedById: adminId,
            },
          ],
          skipDuplicates: true,
        });
      }
    }
  }
}
