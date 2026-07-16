import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AcademicStatsResponse } from '@eims/types';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class AcademicStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(branchId: string | null): Promise<AcademicStatsResponse> {
    const cacheKey = `academic:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<AcademicStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
    const thirtyAgo = thirtyDaysAgo();
    const base = { deletedAt: null, ...branchFilter };
    const previous = { ...base, createdAt: { lte: thirtyAgo } };

    const [
      programs,
      programsPrev,
      batches,
      batchesPrev,
      subjects,
      subjectsPrev,
      sessions,
      sessionsPrev,
    ] = await Promise.all([
      this.prisma.program.count({ where: base }),
      this.prisma.program.count({ where: previous }),
      this.prisma.batch.count({ where: base }),
      this.prisma.batch.count({ where: previous }),
      this.prisma.subject.count({ where: { deletedAt: null } }),
      this.prisma.subject.count({ where: { deletedAt: null, createdAt: { lte: thirtyAgo } } }),
      this.prisma.academicSession.count(),
      this.prisma.academicSession.count({ where: { createdAt: { lte: thirtyAgo } } }),
    ]);

    const result: AcademicStatsResponse = {
      programs: countWithTrend(programs, programsPrev),
      batches: countWithTrend(batches, batchesPrev),
      subjects: countWithTrend(subjects, subjectsPrev),
      sessions: countWithTrend(sessions, sessionsPrev),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }
}
