import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@eims/database';

/**
 * Session/direct DB client for long-running import jobs.
 * Prefers DIRECT_URL (:5432 / db host) over DATABASE_URL transaction pooler (:6543).
 */
@Injectable()
export class ImportPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportPrismaService.name);

  constructor() {
    const direct = process.env.DIRECT_URL?.trim();
    const fallback = process.env.DATABASE_URL?.trim();
    const url = direct || fallback;
    super({
      datasources: url ? { db: { url } } : undefined,
      log:
        process.env.DEBUG_PRISMA === '1'
          ? [{ emit: 'stdout' as const, level: 'query' as const }]
          : [],
    });
    this.logger.log(
      direct
        ? 'Import worker using DIRECT_URL (session connection)'
        : 'Import worker using DATABASE_URL (set DIRECT_URL for faster/stable imports)',
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
