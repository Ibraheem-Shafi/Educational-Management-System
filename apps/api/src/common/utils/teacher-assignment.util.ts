import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@eims/types';
import type { PrismaService } from '../../prisma/prisma.module';

const OVERRIDE_ROLES = new Set(['super_admin', 'branch_admin']);

export function isAssignedTeacherScope(user: AuthUser): boolean {
  return user.roles.includes('teacher') && !user.roles.some((role) => OVERRIDE_ROLES.has(role));
}

export async function getAssignedBatchIds(
  prisma: PrismaService,
  teacherId: string,
): Promise<string[]> {
  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, isActive: true },
    select: { batchId: true },
    distinct: ['batchId'],
  });
  return slots.map((slot) => slot.batchId);
}

export async function assertTeacherAssignedBatch(
  prisma: PrismaService,
  user: AuthUser,
  batchId: string | null | undefined,
): Promise<void> {
  if (!isAssignedTeacherScope(user)) return;
  if (!batchId) {
    throw new ForbiddenException('A class is required');
  }
  const assigned = await getAssignedBatchIds(prisma, user.id);
  if (!assigned.includes(batchId)) {
    throw new ForbiddenException('You can only access your assigned classes');
  }
}
