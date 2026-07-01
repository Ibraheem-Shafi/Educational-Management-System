import type { Prisma } from '@prisma/client';
import { recentWeekdays } from '../utils';

const ATTENDANCE_ENTITY_STUDENT = 'student';

export function buildAttendanceRecords(
  students: Array<{ id: string; branchId: string; demoKey: string }>,
  statusIds: Record<string, string>,
  markedById: string | null,
  weekdays = 20,
): Prisma.AttendanceRecordCreateManyInput[] {
  const dates = recentWeekdays(weekdays);
  const records: Prisma.AttendanceRecordCreateManyInput[] = [];

  students.forEach((student, si) => {
    dates.forEach((date, di) => {
      const roll = (si * 11 + di * 17) % 100;
      let code = 'present';
      if (roll >= 78 && roll < 86) code = 'late';
      else if (roll >= 86 && roll < 93) code = 'absent';
      else if (roll >= 93) code = 'leave';

      records.push({
        branchId: student.branchId,
        entityType: ATTENDANCE_ENTITY_STUDENT,
        entityId: student.id,
        date,
        statusId: statusIds[code],
        markedById,
      });
    });
  });

  return records;
}
