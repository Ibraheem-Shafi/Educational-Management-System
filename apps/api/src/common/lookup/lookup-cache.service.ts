import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';

export interface LookupStatusRef {
  id: string;
  code: string;
  label: string;
}

@Injectable()
export class LookupCacheService {
  private readonly cache = new Map<string, LookupStatusRef>();

  constructor(private readonly prisma: PrismaService) {}

  async getStatusId(categoryCode: string, statusCode: string): Promise<string | null> {
    const key = `${categoryCode}:${statusCode}`;
    const cached = this.cache.get(key);
    if (cached) return cached.id;

    const row = await this.prisma.lookupStatus.findFirst({
      where: { code: statusCode, category: { code: categoryCode } },
      select: { id: true, code: true, label: true },
    });
    if (!row) return null;

    this.cache.set(key, row);
    return row.id;
  }

  async getStatus(categoryCode: string, statusCode: string): Promise<LookupStatusRef | null> {
    const key = `${categoryCode}:${statusCode}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const row = await this.prisma.lookupStatus.findFirst({
      where: { code: statusCode, category: { code: categoryCode } },
      select: { id: true, code: true, label: true },
    });
    if (!row) return null;

    this.cache.set(key, row);
    return row;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
