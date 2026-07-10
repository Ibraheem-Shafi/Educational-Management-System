import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, TimetableStatsResponse } from '@eims/types';
import type {
  CreateTimetableSlotInput,
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

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(branchId: string | null): Promise<TimetableStatsResponse> {
    const cacheKey = `timetable:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<TimetableStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
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

  async findAll(query: ListTimetableQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        isActive: true,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.room ? { room: query.room } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const enriched = await this.enrichSlots(slots);
    return { data: enriched };
  }

  async create(input: CreateTimetableSlotInput, user: AuthUser) {
    await this.assertNoConflicts(input);
    const slot = await this.prisma.timetableSlot.create({ data: input });
    await this.audit.log({
      userId: user.id,
      action: 'timetable_slot.created',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      newValue: slot,
    });
    const [enriched] = await this.enrichSlots([slot]);
    return enriched;
  }

  async update(id: string, input: UpdateTimetableSlotInput, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id, isActive: true, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Timetable slot not found');

    const merged = {
      branchId: existing.branchId,
      batchId: input.batchId ?? existing.batchId,
      subjectId: input.subjectId ?? existing.subjectId,
      teacherId: input.teacherId !== undefined ? input.teacherId : existing.teacherId,
      dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      room: input.room !== undefined ? input.room : existing.room,
    };

    await this.assertNoConflicts(merged, id);

    const slot = await this.prisma.timetableSlot.update({
      where: { id },
      data: {
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
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

    const [enriched] = await this.enrichSlots([slot]);
    return enriched;
  }

  async remove(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id, isActive: true, ...(branchId ? { branchId } : {}) },
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

    return { deleted: true };
  }

  async getConflicts(query: ListTimetableQuery, branchId: string | null) {
    const { data } = await this.findAll(query, branchId);
    const conflicts: Array<{ slotId: string; type: string; message: string }> = [];

    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const a = data[i];
        const b = data[j];
        if (a.dayOfWeek !== b.dayOfWeek) continue;
        if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

        if (a.teacherId && a.teacherId === b.teacherId) {
          conflicts.push({
            slotId: a.id,
            type: 'teacher',
            message: `Teacher conflict with slot ${b.startTime}–${b.endTime}`,
          });
        }
        if (a.room && b.room && a.room === b.room) {
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

  private async assertNoConflicts(
    input: {
      branchId: string;
      batchId: string;
      teacherId?: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string | null;
    },
    excludeId?: string,
  ) {
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

      if (input.teacherId && peer.teacherId === input.teacherId) {
        throw new BadRequestException('Teacher already has a class at this time');
      }
      if (input.room && peer.room && peer.room === input.room) {
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
