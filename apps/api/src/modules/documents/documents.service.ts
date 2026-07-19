import { prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, DocumentsStatsResponse } from '@eims/types';
import type { CreateDocumentInput, ListDocumentsQuery } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;
const DOCUMENTS_BUCKET = 'student-documents';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name);
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

  /** Ensure the storage bucket exists so client uploads don't fail with "Bucket not found". */
  async onModuleInit(): Promise<void> {
    if (!this.supabaseAdmin) return;
    try {
      const { data } = await this.supabaseAdmin.storage.getBucket(DOCUMENTS_BUCKET);
      if (!data) {
        await this.supabaseAdmin.storage.createBucket(DOCUMENTS_BUCKET, { public: false });
        this.logger.log(`Created storage bucket "${DOCUMENTS_BUCKET}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not verify/create storage bucket "${DOCUMENTS_BUCKET}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async getStats(scope: BranchScope): Promise<DocumentsStatsResponse> {
    const cacheKey = `documents:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<DocumentsStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
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

  async findAll(query: ListDocumentsQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(effective),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              {
                student: {
                  fullName: { contains: query.search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: { select: { id: true, fullName: true } },
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: docs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
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

  async remove(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.document.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
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

  async getSignedUrl(id: string, scope: BranchScope) {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.supabaseAdmin) {
      return { url: doc.storagePath, signed: false };
    }

    // Some records (e.g. demo seed) store the path with a redundant bucket
    // prefix; strip it so the object key resolves correctly inside the bucket.
    const objectKey = doc.storagePath.replace(/^student-documents\//, '');

    const { data, error } = await this.supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(objectKey, 3600);

    if (error) {
      throw new NotFoundException(
        'This file is no longer available in storage. It may not have been uploaded in this environment.',
      );
    }
    return { url: data.signedUrl, signed: true };
  }
}
