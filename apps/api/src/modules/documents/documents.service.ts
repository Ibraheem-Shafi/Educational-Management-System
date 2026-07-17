import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, DocumentsStatsResponse } from '@eims/types';
import type { CreateDocumentInput, ListDocumentsQuery } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class DocumentsService {
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly ttlCache: TtlCacheService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabaseAdmin = createClient(url, key);
    }
  }

  async getStats(branchId: string | null): Promise<DocumentsStatsResponse> {
    const cacheKey = `documents:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<DocumentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
    const thirtyAgo = thirtyDaysAgo();
    const base = { deletedAt: null, ...branchFilter };

    const [total, totalPrev, recent, recentPrev, studentDocs, otherDocs] = await Promise.all([
      this.prisma.document.count({ where: base }),
      this.prisma.document.count({ where: { ...base, createdAt: { lte: thirtyAgo } } }),
      this.prisma.document.count({ where: { ...base, createdAt: { gte: thirtyAgo } } }),
      this.prisma.document.count({
        where: {
          ...base,
          createdAt: {
            gte: new Date(thirtyAgo.getTime() - 30 * 86400000),
            lt: thirtyAgo,
          },
        },
      }),
      this.prisma.document.count({ where: { ...base, studentId: { not: null } } }),
      this.prisma.document.count({ where: { ...base, studentId: null } }),
    ]);

    const result: DocumentsStatsResponse = {
      totalFiles: countWithTrend(total, totalPrev),
      recentUploads: countWithTrend(recent, recentPrev),
      studentDocuments: countWithTrend(studentDocs, 0),
      otherDocuments: countWithTrend(otherDocs, 0),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(query: ListDocumentsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const docs = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
    return { data: docs };
  }

  async create(input: CreateDocumentInput, user: AuthUser) {
    if (input.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
      });
      if (!student) throw new NotFoundException('Student not found');
    } else if (input.userId) {
      const employee = await this.prisma.user.findFirst({
        where: { id: input.userId, branchId: input.branchId, deletedAt: null },
      });
      if (!employee) throw new NotFoundException('User not found');
    }

    const doc = await this.prisma.document.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId ?? null,
        userId: input.userId ?? null,
        category: input.category,
        title: input.title,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById: user.id,
      },
      include: {
        student: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'document.created',
      entityType: 'Document',
      entityId: doc.id,
      newValue: doc,
    });

    return doc;
  }

  async remove(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.document.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Document not found');

    const doc = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'document.deleted',
      entityType: 'Document',
      entityId: doc.id,
      previousValue: existing,
    });

    return { deleted: true };
  }

  async getSignedUrl(id: string, branchId: string | null) {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.supabaseAdmin) {
      return { url: doc.storagePath, signed: false };
    }

    const { data, error } = await this.supabaseAdmin.storage
      .from('student-documents')
      .createSignedUrl(doc.storagePath, 3600);

    if (error) throw new NotFoundException(error.message);
    return { url: data.signedUrl, signed: true };
  }
}
