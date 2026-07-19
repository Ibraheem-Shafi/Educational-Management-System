import { narrowScope, prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, NoticesStatsResponse } from '@eims/types';
import type { CreateNoticeInput, UpdateNoticeInput, ListNoticesQuery } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(scope: BranchScope): Promise<NoticesStatsResponse> {
    await this.promoteDueScheduledNotices();

    const cacheKey = `notices:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<NoticesStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const thirtyAgo = thirtyDaysAgo();
    const now = new Date();

    const draftWhere = { ...branchFilter, isPublished: false, publishedAt: null };
    const scheduledWhere = {
      ...branchFilter,
      isPublished: false,
      publishedAt: { gt: now },
    };

    const [published, publishedPrev, draft, draftPrev, scheduled, scheduledPrev, total] =
      await Promise.all([
        this.prisma.notice.count({ where: { ...branchFilter, isPublished: true } }),
        this.prisma.notice.count({
          where: { ...branchFilter, isPublished: true, createdAt: { lte: thirtyAgo } },
        }),
        this.prisma.notice.count({ where: draftWhere }),
        this.prisma.notice.count({
          where: { ...draftWhere, createdAt: { lte: thirtyAgo } },
        }),
        this.prisma.notice.count({ where: scheduledWhere }),
        this.prisma.notice.count({
          where: {
            ...branchFilter,
            isPublished: false,
            publishedAt: { not: null, lte: thirtyAgo },
          },
        }),
        this.prisma.notice.count({ where: branchFilter }),
      ]);

    const result: NoticesStatsResponse = {
      published: countWithTrend(published, publishedPrev),
      draft: countWithTrend(draft, draftPrev),
      scheduled: countWithTrend(scheduled, scheduledPrev),
      totalViews: countWithTrend(total, total),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListNoticesQuery, scope: BranchScope) {
    await this.promoteDueScheduledNotices();

    const now = new Date();

    const statusWhere =
      query.status === 'published'
        ? { isPublished: true }
        : query.status === 'scheduled'
          ? { isPublished: false, publishedAt: { gt: now } }
          : query.status === 'draft'
            ? { isPublished: false, publishedAt: null }
            : {};

    const where = {
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.publishedOnly ? { isPublished: true } : {}),
      ...statusWhere,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { body: { contains: query.search, mode: 'insensitive' as const } },
              { id: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notice.count({ where }),
    ]);

    return {
      data: notices.map(this.toResponse),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, scope: BranchScope) {
    await this.promoteDueScheduledNotices();

    const notice = await this.prisma.notice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.toResponse(notice);
  }

  async create(input: CreateNoticeInput, user: AuthUser) {
    const scheduledAt = this.parseScheduleTime(input.publishedAt);

    const notice = await this.prisma.notice.create({
      data: {
        branchId: input.branchId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        createdById: user.id,
        isPublished: false,
        publishedAt: scheduledAt,
      },
    });
    this.invalidateStatsCache();
    await this.audit.log({
      userId: user.id,
      action: scheduledAt ? 'notice.scheduled' : 'notice.created',
      entityType: 'Notice',
      entityId: notice.id,
      newValue: notice,
    });
    return this.toResponse(notice);
  }

  async update(id: string, input: UpdateNoticeInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.notice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Notice not found');

    const publishing = input.isPublished === true && !existing.isPublished;
    const scheduledAt =
      input.publishedAt !== undefined ? this.parseScheduleTime(input.publishedAt) : undefined;

    if (scheduledAt && (input.isPublished === true || existing.isPublished)) {
      throw new BadRequestException('Cannot schedule a published notice');
    }

    const notice = await this.prisma.notice.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(publishing ? { publishedAt: new Date() } : {}),
        ...(!publishing && scheduledAt !== undefined ? { publishedAt: scheduledAt } : {}),
      },
    });

    this.invalidateStatsCache();
    await this.audit.log({
      userId: user.id,
      action: publishing
        ? 'notice.published'
        : scheduledAt
          ? 'notice.scheduled'
          : 'notice.updated',
      entityType: 'Notice',
      entityId: notice.id,
      previousValue: existing,
      newValue: notice,
    });

    return this.toResponse(notice);
  }

  async remove(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.notice.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Notice not found');

    await this.prisma.notice.delete({ where: { id } });

    this.invalidateStatsCache();
    await this.audit.log({
      userId: user.id,
      action: 'notice.deleted',
      entityType: 'Notice',
      entityId: id,
      previousValue: existing,
    });

    return { success: true };
  }

  private invalidateStatsCache(): void {
    this.ttlCache.deleteByPrefix('notices:stats:');
  }

  /** Flip scheduled notices whose publish time has arrived. */
  private async promoteDueScheduledNotices(): Promise<void> {
    const result = await this.prisma.notice.updateMany({
      where: {
        isPublished: false,
        publishedAt: { not: null, lte: new Date() },
      },
      data: { isPublished: true },
    });
    if (result.count > 0) {
      this.invalidateStatsCache();
    }
  }

  private parseScheduleTime(value: string | null | undefined): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid publish schedule time');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Publish schedule must be in the future');
    }
    return scheduledAt;
  }

  async getPortalNotices(user: AuthUser, scope: BranchScope) {
    await this.promoteDueScheduledNotices();

    const audiences: string[] = ['all'];
    if (user.roles.includes('parent')) audiences.push('parents');
    if (user.roles.includes('student')) audiences.push('students');
    if (user.roles.includes('teacher')) audiences.push('teachers');
    if (user.roles.some((r) => ['branch_admin', 'receptionist', 'accountant'].includes(r))) {
      audiences.push('staff');
    }

    const notices = await this.prisma.notice.findMany({
      where: {
        isPublished: true,
        audience: { in: audiences },
        ...prismaBranchFilter(scope),
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    return { data: notices.map(this.toResponse) };
  }

  private toResponse(notice: {
    id: string;
    branchId: string;
    title: string;
    body: string;
    audience: string;
    isPublished: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: notice.id,
      branchId: notice.branchId,
      title: notice.title,
      body: notice.body,
      audience: notice.audience,
      isPublished: notice.isPublished,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    };
  }
}
