import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, daysAgo } from '../../common/utils/stats.util';
import type { AuditStatsResponse, PaginatedResponse } from '@eims/types';
import type { ListAuditLogsQuery } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(): Promise<AuditStatsResponse> {
    const cacheKey = 'audit:stats';
    const cached = this.ttlCache.get<AuditStatsResponse>(cacheKey);
    if (cached) return cached;

    const last24h = daysAgo(1);
    const last7d = daysAgo(7);
    const prev24h = daysAgo(2);
    const prev7d = daysAgo(14);

    const [events24h, events24hPrev, events7d, events7dPrev, actors, topAction] =
      await Promise.all([
        this.prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
        this.prisma.auditLog.count({
          where: { createdAt: { gte: prev24h, lt: last24h } },
        }),
        this.prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
        this.prisma.auditLog.count({
          where: { createdAt: { gte: prev7d, lt: last7d } },
        }),
        this.prisma.auditLog.groupBy({
          by: ['userId'],
          where: { createdAt: { gte: last7d }, userId: { not: null } },
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: { createdAt: { gte: last7d } },
          _count: { _all: true },
          orderBy: { _count: { action: 'desc' } },
          take: 1,
        }),
      ]);

    const topCount = topAction[0]?._count._all ?? 0;

    const result: AuditStatsResponse = {
      eventsLast24h: countWithTrend(events24h, events24hPrev),
      eventsLast7d: countWithTrend(events7d, events7dPrev),
      uniqueActors: countWithTrend(actors.length, 0),
      topActionCount: countWithTrend(topCount, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListAuditLogsQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        user: log.userId ? userMap.get(log.userId) ?? null : null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
