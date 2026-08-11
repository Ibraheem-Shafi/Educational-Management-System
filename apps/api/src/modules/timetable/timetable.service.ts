import { narrowScope, prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, TimetableStatsResponse } from '@eims/types';
import type {
  CreateTimetableSlotInput,
  CreateTimetableSlotsBulkInput,
  ListTimetableQuery,
  UpdateTimetableSlotInput,
} from '@eims/shared';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a0 = toMinutes(startA);
  const a1 = toMinutes(endA);
  const b0 = toMinutes(startB);
  const b1 = toMinutes(endB);
  return a0 < b1 && b0 < a1;
}

function roomSearchWhere(roomQuery: string) {
  const terms = roomQuery.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return {};
  if (terms.length === 1) {
    return { room: { contains: terms[0], mode: 'insensitive' as const } };
  }
  return {
    AND: terms.map((term) => ({
      room: { contains: term, mode: 'insensitive' as const },
    })),
  };
}

const STATS_CACHE_TTL_MS = 45_000;

type SlotConflictInput = {
  branchId: string;
  batchId: string;
  subjectId: string;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
};

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(scope: BranchScope): Promise<TimetableStatsResponse> {
    const cacheKey = `timetable:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<TimetableStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const base = { isActive: true, ...branchFilter };
    const thirtyAgo = thirtyDaysAgo();

    const [slots, slotsPrev, rooms, teachers, batches] = await Promise.all([
      this.prisma.timetableSlot.count({ where: base }),
      this.prisma.timetableSlot.count({ where: { ...base, createdAt: { lte: thirtyAgo } } }),
      this.prisma.timetableSlot.groupBy({
        by: ['room'],
        where: { ...base, room: { not: null } },
      }),
      this.prisma.timetableSlot.groupBy({
        by: ['teacherId'],
        where: { ...base, teacherId: { not: null } },
      }),
      this.prisma.timetableSlot.groupBy({
        by: ['batchId'],
        where: base,
      }),
    ]);

    const result: TimetableStatsResponse = {
      slotsPerWeek: countWithTrend(slots, slotsPrev),
      roomsUsed: countWithTrend(rooms.length, 0),
      teachersScheduled: countWithTrend(teachers.length, 0),
      batchesScheduled: countWithTrend(batches.length, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListTimetableQuery, scope: BranchScope) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        isActive: true,
        ...prismaBranchFilter(narrowScope(scope, query.branchId)),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...roomSearchWhere(query.room ?? ''),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const enriched = await this.enrichSlots(slots);
    return { data: enriched };
  }

  async create(input: CreateTimetableSlotInput, user: AuthUser) {
    const normalized = this.normalizeSlotInput(input);
    await this.assertEntitiesValid(normalized, { teacherStrict: true });
    await this.assertNoConflicts(normalized);
    const slot = await this.prisma.timetableSlot.create({
      data: {
        branchId: normalized.branchId,
        batchId: normalized.batchId,
        subjectId: normalized.subjectId,
        teacherId: normalized.teacherId,
        dayOfWeek: normalized.dayOfWeek,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        room: normalized.room,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'timetable_slot.created',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      newValue: slot,
    });
    this.ttlCache.deleteByPrefix('timetable:stats:');
    const [enriched] = await this.enrichSlots([slot]);
    return enriched;
  }

  /**
   * Create the same class on multiple weekdays. Conflicts skip that day only
   * (partial success) so schedule building is not all-or-nothing.
   */
  async createBulk(input: CreateTimetableSlotsBulkInput, user: AuthUser) {
    const base: Omit<SlotConflictInput, 'dayOfWeek'> = {
      branchId: input.branchId,
      batchId: input.batchId,
      subjectId: input.subjectId,
      teacherId: input.teacherId ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? null,
    };

    // Validate shared entities once using an arbitrary day.
    await this.assertEntitiesValid({ ...base, dayOfWeek: input.daysOfWeek[0] }, { teacherStrict: true });

    const created: Awaited<ReturnType<TimetableService['enrichSlots']>> = [];
    const skipped: Array<{ dayOfWeek: number; reason: string }> = [];

    const sortedDays = [...input.daysOfWeek].sort((a, b) => a - b);

    for (const dayOfWeek of sortedDays) {
      const payload: SlotConflictInput = { ...base, dayOfWeek };
      try {
        await this.assertNoConflicts(payload);
        const slot = await this.prisma.timetableSlot.create({
          data: {
            branchId: payload.branchId,
            batchId: payload.batchId,
            subjectId: payload.subjectId,
            teacherId: payload.teacherId ?? null,
            dayOfWeek: payload.dayOfWeek,
            startTime: payload.startTime,
            endTime: payload.endTime,
            room: payload.room ?? null,
          },
        });
        await this.audit.log({
          userId: user.id,
          action: 'timetable_slot.created',
          entityType: 'TimetableSlot',
          entityId: slot.id,
          newValue: slot,
        });
        const [enriched] = await this.enrichSlots([slot]);
        created.push(enriched);
      } catch (err) {
        const reason =
          err instanceof BadRequestException
            ? (typeof err.getResponse() === 'string'
                ? (err.getResponse() as string)
                : ((err.getResponse() as { message?: string | string[] }).message ??
                    err.message))
            : err instanceof Error
              ? err.message
              : 'Could not create slot';
        const message = Array.isArray(reason) ? reason[0] : String(reason);
        skipped.push({ dayOfWeek, reason: message });
      }
    }

    if (created.length > 0) {
      this.ttlCache.deleteByPrefix('timetable:stats:');
    }

    if (created.length === 0 && skipped.length > 0) {
      throw new BadRequestException(
        skipped.map((s) => `Day ${s.dayOfWeek}: ${s.reason}`).join('; '),
      );
    }

    return { created, skipped };
  }

  async update(id: string, input: UpdateTimetableSlotInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id, isActive: true, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Timetable slot not found');

    const merged: SlotConflictInput = {
      branchId: existing.branchId,
      batchId: input.batchId ?? existing.batchId,
      subjectId: input.subjectId ?? existing.subjectId,
      teacherId: input.teacherId !== undefined ? input.teacherId : existing.teacherId,
      dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      room: input.room !== undefined ? input.room : existing.room,
    };

    // Teacher is optional: only hard-fail when the client is setting teacherId.
    // Stale/deleted teachers on existing slots are cleared so day-moves still work.
    const teacherStrict = input.teacherId !== undefined;
    await this.assertEntitiesValid(merged, { teacherStrict });
    await this.assertNoConflicts(merged, id);

    const clearStaleTeacher =
      !teacherStrict && existing.teacherId != null && merged.teacherId == null;

    const slot = await this.prisma.timetableSlot.update({
      where: { id },
      data: {
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.teacherId !== undefined
          ? { teacherId: input.teacherId }
          : clearStaleTeacher
            ? { teacherId: null }
            : {}),
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
        ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
        ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
        ...(input.room !== undefined ? { room: input.room } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'timetable_slot.updated',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      previousValue: existing,
      newValue: slot,
    });

    this.ttlCache.deleteByPrefix('timetable:stats:');
    const [enriched] = await this.enrichSlots([slot]);
    return enriched;
  }

  async remove(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id, isActive: true, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Timetable slot not found');

    const slot = await this.prisma.timetableSlot.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      userId: user.id,
      action: 'timetable_slot.deleted',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      previousValue: existing,
    });

    this.ttlCache.deleteByPrefix('timetable:stats:');
    return { deleted: true };
  }

  async getConflicts(query: ListTimetableQuery, scope: BranchScope) {
    const { data } = await this.findAll(query, scope);
    const conflicts: Array<{ slotId: string; type: string; message: string }> = [];

    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const a = data[i];
        const b = data[j];
        if (a.dayOfWeek !== b.dayOfWeek) continue;
        if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

        if (a.batchId === b.batchId) {
          conflicts.push({
            slotId: a.id,
            type: 'batch',
            message: `Batch conflict with slot ${b.startTime}–${b.endTime}`,
          });
        }
        if (a.teacherId && a.teacherId === b.teacherId) {
          conflicts.push({
            slotId: a.id,
            type: 'teacher',
            message: `Teacher conflict with slot ${b.startTime}–${b.endTime}`,
          });
        }
        if (a.room && b.room && a.room.toLowerCase() === b.room.toLowerCase()) {
          conflicts.push({
            slotId: a.id,
            type: 'room',
            message: `Room "${a.room}" conflict with slot ${b.startTime}–${b.endTime}`,
          });
        }
      }
    }

    return { conflicts };
  }

  private normalizeSlotInput(input: CreateTimetableSlotInput): SlotConflictInput {
    return {
      branchId: input.branchId,
      batchId: input.batchId,
      subjectId: input.subjectId,
      teacherId: input.teacherId ?? null,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? null,
    };
  }

  private async assertEntitiesValid(
    input: SlotConflictInput,
    options: { teacherStrict: boolean },
  ) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, deletedAt: null },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!batch || !batch.isActive) {
      throw new BadRequestException('Batch not found or inactive');
    }
    if (batch.branchId !== input.branchId) {
      throw new BadRequestException('Batch does not belong to this branch');
    }

    const subject = await this.prisma.subject.findFirst({
      where: { id: input.subjectId, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!subject || !subject.isActive) {
      throw new BadRequestException('Subject not found or inactive');
    }

    const linkedCount = await this.prisma.batchSubject.count({
      where: { batchId: input.batchId },
    });
    if (linkedCount > 0) {
      const link = await this.prisma.batchSubject.findFirst({
        where: { batchId: input.batchId, subjectId: input.subjectId },
      });
      if (!link) {
        throw new BadRequestException('Subject is not assigned to this batch');
      }
    }

    if (!input.teacherId) return;

    const teacher = await this.prisma.user.findFirst({
      where: { id: input.teacherId, deletedAt: null },
      select: {
        id: true,
        isActive: true,
        branchId: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });

    const roleCodes = teacher?.userRoles.map((ur) => ur.role.code) ?? [];
    const validTeacher =
      !!teacher &&
      teacher.isActive &&
      (!teacher.branchId || teacher.branchId === input.branchId) &&
      (roleCodes.includes('teacher') ||
        roleCodes.includes('branch_admin') ||
        roleCodes.includes('super_admin'));

    if (validTeacher) return;

    if (options.teacherStrict) {
      if (!teacher || !teacher.isActive) {
        throw new BadRequestException('Teacher not found or inactive');
      }
      if (teacher.branchId && teacher.branchId !== input.branchId) {
        throw new BadRequestException('Teacher does not belong to this branch');
      }
      throw new BadRequestException('Selected user is not a teacher');
    }

    // Optional teacher on an existing slot — drop stale reference so moves/edits proceed.
    input.teacherId = null;
  }

  private async assertNoConflicts(input: SlotConflictInput, excludeId?: string) {
    const peers = await this.prisma.timetableSlot.findMany({
      where: {
        branchId: input.branchId,
        dayOfWeek: input.dayOfWeek,
        isActive: true,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    for (const peer of peers) {
      if (!timesOverlap(input.startTime, input.endTime, peer.startTime, peer.endTime)) continue;

      if (peer.batchId === input.batchId) {
        throw new BadRequestException('This batch already has a class at this time');
      }
      if (input.teacherId && peer.teacherId === input.teacherId) {
        throw new BadRequestException('Teacher already has a class at this time');
      }
      if (
        input.room &&
        peer.room &&
        peer.room.toLowerCase() === input.room.toLowerCase()
      ) {
        throw new BadRequestException(`Room "${input.room}" is already booked at this time`);
      }
    }
  }

  private async enrichSlots(slots: Array<{
    id: string;
    branchId: string;
    batchId: string;
    subjectId: string;
    teacherId: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    isActive: boolean;
  }>) {
    if (slots.length === 0) return [];

    const batchIds = [...new Set(slots.map((s) => s.batchId))];
    const subjectIds = [...new Set(slots.map((s) => s.subjectId))];
    const teacherIds = [...new Set(slots.map((s) => s.teacherId).filter(Boolean))] as string[];

    const [batches, subjects, teachers] = await Promise.all([
      this.prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, name: true } }),
      this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }),
      teacherIds.length
        ? this.prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, fullName: true } })
        : [],
    ]);

    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    return slots.map((slot) => ({
      ...slot,
      batch: batchMap.get(slot.batchId) ?? null,
      subject: subjectMap.get(slot.subjectId) ?? null,
      teacher: slot.teacherId ? teacherMap.get(slot.teacherId) ?? null : null,
    }));
  }
}
