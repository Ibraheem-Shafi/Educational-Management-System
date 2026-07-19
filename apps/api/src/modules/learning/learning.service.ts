import { narrowScope, prismaBranchFilter, scopeCacheKey } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type {
  AuthUser,
  LearningResourceResponse,
  LearningStatsResponse,
  PaginatedResponse,
} from '@eims/types';
import type {
  CreateLearningResourceInput,
  UpdateLearningResourceInput,
  ListLearningQuery,
  AddLearningAttachmentInput,
} from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;
const LEARNING_BUCKET = 'learning-content';

@Injectable()
export class LearningService {
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

  private canPublishAnyScope(user: AuthUser): boolean {
    return user.permissions.includes('users.manage') || user.roles.includes('branch_admin') || user.roles.includes('super_admin');
  }

  private async assertTeacherCanPublish(
    user: AuthUser,
    batchId: string | null | undefined,
    subjectId: string | null | undefined,
  ) {
    if (this.canPublishAnyScope(user)) return;
    if (!user.permissions.includes('learning.publish')) {
      throw new ForbiddenException('Missing learning.publish permission');
    }
    // Teachers: allow any batch in their branch (v1); tighten via timetable later if needed
    if (!user.branchId) {
      throw new ForbiddenException('Teachers must be assigned to a branch to publish');
    }
    if (batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: batchId, branchId: user.branchId, deletedAt: null },
      });
      if (!batch) throw new ForbiddenException('Batch not in your branch');
    }
    if (subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: subjectId, deletedAt: null },
      });
      if (!subject) throw new BadRequestException('Subject not found');
    }
  }

  async getStats(scope: BranchScope): Promise<LearningStatsResponse> {
    const cacheKey = `learning:stats:${scopeCacheKey(scope)}`;
    const cached = this.ttlCache.get<LearningStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = prismaBranchFilter(scope);
    const base = { deletedAt: null, ...branchFilter };
    const thirtyAgo = thirtyDaysAgo();
    const dueSoonEnd = new Date();
    dueSoonEnd.setUTCDate(dueSoonEnd.getUTCDate() + 7);

    const [published, publishedPrev, drafts, draftsPrev, homework, homeworkPrev, dueSoon] =
      await Promise.all([
        this.prisma.learningResource.count({ where: { ...base, isPublished: true } }),
        this.prisma.learningResource.count({
          where: { ...base, isPublished: true, createdAt: { lte: thirtyAgo } },
        }),
        this.prisma.learningResource.count({ where: { ...base, isPublished: false } }),
        this.prisma.learningResource.count({
          where: { ...base, isPublished: false, createdAt: { lte: thirtyAgo } },
        }),
        this.prisma.learningResource.count({ where: { ...base, type: 'homework' } }),
        this.prisma.learningResource.count({
          where: { ...base, type: 'homework', createdAt: { lte: thirtyAgo } },
        }),
        this.prisma.learningResource.count({
          where: {
            ...base,
            type: 'homework',
            isPublished: true,
            dueAt: { gte: new Date(), lte: dueSoonEnd },
          },
        }),
      ]);

    const result: LearningStatsResponse = {
      published: countWithTrend(published, publishedPrev),
      drafts: countWithTrend(drafts, draftsPrev),
      homework: countWithTrend(homework, homeworkPrev),
      dueSoon: countWithTrend(dueSoon, 0),
    };
    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async findAll(
    query: ListLearningQuery,
    scope: BranchScope,
  ): Promise<PaginatedResponse<LearningResourceResponse>> {
    const where: Prisma.LearningResourceWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.type ? { type: query.type } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.publishedOnly ? { isPublished: true } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.learningResource.findMany({
        where,
        include: { attachments: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ isPublished: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.learningResource.count({ where }),
    ]);

    const enriched = await this.enrichResources(rows);

    return {
      data: enriched,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async findOne(id: string, scope: BranchScope): Promise<LearningResourceResponse> {
    const resource = await this.prisma.learningResource.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { attachments: true },
    });
    if (!resource) throw new NotFoundException('Learning resource not found');
    const [enriched] = await this.enrichResources([resource]);
    return enriched;
  }

  async create(input: CreateLearningResourceInput, user: AuthUser): Promise<LearningResourceResponse> {
    await this.assertTeacherCanPublish(user, input.batchId, input.subjectId);

    const resource = await this.prisma.learningResource.create({
      data: {
        branchId: input.branchId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        body: input.body ?? null,
        programId: input.programId ?? null,
        batchId: input.batchId ?? null,
        subjectId: input.subjectId ?? null,
        visibilityScope: input.visibilityScope,
        audience: input.audience,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        maxMarks: input.maxMarks ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        meetingUrl: input.meetingUrl || null,
        meetingPlatform: input.meetingPlatform ?? null,
        isPublished: input.isPublished ?? false,
        publishedAt: input.isPublished ? new Date() : null,
        createdById: user.id,
        attachments: {
          create: (input.attachments ?? []).map((a) => ({
            fileName: a.fileName,
            storagePath: a.storagePath,
            mimeType: a.mimeType ?? null,
            sizeBytes: a.sizeBytes ?? null,
          })),
        },
      },
      include: { attachments: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'learning.created',
      entityType: 'LearningResource',
      entityId: resource.id,
      newValue: { title: resource.title, type: resource.type },
    });

    const [enriched] = await this.enrichResources([resource]);
    return enriched;
  }

  async update(
    id: string,
    input: UpdateLearningResourceInput,
    user: AuthUser,
    scope: BranchScope,
  ): Promise<LearningResourceResponse> {
    const existing = await this.prisma.learningResource.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Learning resource not found');

    await this.assertTeacherCanPublish(
      user,
      input.batchId !== undefined ? input.batchId : existing.batchId,
      input.subjectId !== undefined ? input.subjectId : existing.subjectId,
    );

    if (!this.canPublishAnyScope(user) && existing.createdById && existing.createdById !== user.id) {
      throw new ForbiddenException('You can only edit resources you created');
    }

    const isPublished = input.isPublished ?? existing.isPublished;
    const resource = await this.prisma.learningResource.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.programId !== undefined ? { programId: input.programId } : {}),
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.visibilityScope !== undefined ? { visibilityScope: input.visibilityScope } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.dueAt !== undefined
          ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
          : {}),
        ...(input.maxMarks !== undefined ? { maxMarks: input.maxMarks } : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
          : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
        ...(input.meetingUrl !== undefined ? { meetingUrl: input.meetingUrl || null } : {}),
        ...(input.meetingPlatform !== undefined ? { meetingPlatform: input.meetingPlatform } : {}),
        ...(input.isPublished !== undefined
          ? {
              isPublished,
              publishedAt: isPublished ? existing.publishedAt ?? new Date() : null,
            }
          : {}),
      },
      include: { attachments: true },
    });

    await this.audit.log({
      userId: user.id,
      action: 'learning.updated',
      entityType: 'LearningResource',
      entityId: resource.id,
      previousValue: { title: existing.title },
      newValue: { title: resource.title },
    });

    const [enriched] = await this.enrichResources([resource]);
    return enriched;
  }

  async remove(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.learningResource.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Learning resource not found');
    if (!this.canPublishAnyScope(user) && existing.createdById !== user.id) {
      throw new ForbiddenException('You can only delete resources you created');
    }

    await this.prisma.learningResource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'learning.deleted',
      entityType: 'LearningResource',
      entityId: id,
    });

    return { deleted: true };
  }

  async addAttachment(
    id: string,
    input: AddLearningAttachmentInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.learningResource.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Learning resource not found');
    await this.assertTeacherCanPublish(user, existing.batchId, existing.subjectId);

    const attachment = await this.prisma.learningAttachment.create({
      data: {
        resourceId: id,
        fileName: input.fileName,
        storagePath: input.storagePath,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
      },
    });

    return attachment;
  }

  async getAttachmentSignedUrl(
    resourceId: string,
    attachmentId: string,
    scope: BranchScope,
  ) {
    const attachment = await this.prisma.learningAttachment.findFirst({
      where: {
        id: attachmentId,
        resourceId,
        resource: { deletedAt: null, ...prismaBranchFilter(scope) },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (!this.supabaseAdmin) {
      return { url: attachment.storagePath, signed: false };
    }

    const { data, error } = await this.supabaseAdmin.storage
      .from(LEARNING_BUCKET)
      .createSignedUrl(attachment.storagePath, 3600);

    if (error) {
      // Fallback to student-documents if learning bucket missing
      const fallback = await this.supabaseAdmin.storage
        .from('student-documents')
        .createSignedUrl(attachment.storagePath, 3600);
      if (fallback.error) throw new NotFoundException(error.message);
      return { url: fallback.data.signedUrl, signed: true };
    }

    return { url: data.signedUrl, signed: true };
  }

  /** Portal: list resources visible to a student context */
  async listForStudentContext(params: {
    branchId: string;
    programId: string | null;
    batchId: string | null;
    audience: 'students' | 'parents';
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<LearningResourceResponse>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 8;
    const audienceFilter =
      params.audience === 'students'
        ? { audience: { in: ['students', 'all'] } }
        : { audience: { in: ['parents', 'all'] } };

    const scopeOr: Prisma.LearningResourceWhereInput[] = [
      { visibilityScope: 'branch', branchId: params.branchId },
    ];
    if (params.programId) {
      scopeOr.push({
        visibilityScope: 'program',
        branchId: params.branchId,
        programId: params.programId,
      });
    }
    if (params.batchId) {
      scopeOr.push({
        visibilityScope: 'batch',
        batchId: params.batchId,
      });
      scopeOr.push({
        visibilityScope: 'batch_subject',
        batchId: params.batchId,
      });
    }

    const where: Prisma.LearningResourceWhereInput = {
      deletedAt: null,
      isPublished: true,
      branchId: params.branchId,
      ...audienceFilter,
      OR: scopeOr,
      ...(params.type ? { type: params.type } : {}),
      ...(params.search
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: params.search, mode: 'insensitive' as const } },
                  { description: { contains: params.search, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.learningResource.findMany({
        where,
        include: { attachments: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueAt: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.learningResource.count({ where }),
    ]);

    const enriched = await this.enrichResources(rows);
    return {
      data: enriched,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOnePublishedForStudent(
    id: string,
    params: { branchId: string; programId: string | null; batchId: string | null; audience: 'students' | 'parents' },
  ): Promise<LearningResourceResponse> {
    const list = await this.listForStudentContext({ ...params, page: 1, limit: 200 });
    const found = list.data.find((r) => r.id === id);
    if (!found) throw new NotFoundException('Learning resource not found');
    return this.findOne(id, selectedBranchScope([params.branchId]));
  }

  async getDueSoonForStudent(params: {
    branchId: string;
    programId: string | null;
    batchId: string | null;
    audience: 'students' | 'parents';
    limit?: number;
  }) {
    const list = await this.listForStudentContext({
      ...params,
      type: 'homework',
      page: 1,
      limit: 50,
    });
    const now = Date.now();
    return list.data
      .filter((r) => r.dueAt && new Date(r.dueAt).getTime() >= now)
      .slice(0, params.limit ?? 3);
  }

  private async enrichResources(
    rows: Array<{
      id: string;
      branchId: string;
      type: string;
      title: string;
      description: string | null;
      body: string | null;
      programId: string | null;
      batchId: string | null;
      subjectId: string | null;
      visibilityScope: string;
      audience: string;
      dueAt: Date | null;
      maxMarks: Prisma.Decimal | null;
      startsAt: Date | null;
      endsAt: Date | null;
      meetingUrl: string | null;
      meetingPlatform: string | null;
      isPublished: boolean;
      publishedAt: Date | null;
      createdById: string | null;
      createdAt: Date;
      updatedAt: Date;
      attachments: Array<{
        id: string;
        fileName: string;
        storagePath: string;
        mimeType: string | null;
        sizeBytes: number | null;
        createdAt: Date;
      }>;
    }>,
  ): Promise<LearningResourceResponse[]> {
    if (rows.length === 0) return [];

    const batchIds = [...new Set(rows.map((r) => r.batchId).filter(Boolean))] as string[];
    const subjectIds = [...new Set(rows.map((r) => r.subjectId).filter(Boolean))] as string[];
    const programIds = [...new Set(rows.map((r) => r.programId).filter(Boolean))] as string[];
    const userIds = [...new Set(rows.map((r) => r.createdById).filter(Boolean))] as string[];

    const [batches, subjects, programs, users] = await Promise.all([
      batchIds.length
        ? this.prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, name: true } })
        : [],
      subjectIds.length
        ? this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
        : [],
      programIds.length
        ? this.prisma.program.findMany({ where: { id: { in: programIds } }, select: { id: true, name: true } })
        : [],
      userIds.length
        ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
        : [],
    ]);

    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const programMap = new Map(programs.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      type: r.type,
      title: r.title,
      description: r.description,
      body: r.body,
      programId: r.programId,
      batchId: r.batchId,
      subjectId: r.subjectId,
      visibilityScope: r.visibilityScope,
      audience: r.audience,
      dueAt: r.dueAt?.toISOString() ?? null,
      maxMarks: r.maxMarks != null ? Number(r.maxMarks) : null,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      meetingUrl: r.meetingUrl ?? null,
      meetingPlatform: r.meetingPlatform ?? null,
      isPublished: r.isPublished,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      attachments: r.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        storagePath: a.storagePath,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      batch: r.batchId ? batchMap.get(r.batchId) ?? null : null,
      subject: r.subjectId ? subjectMap.get(r.subjectId) ?? null : null,
      program: r.programId ? programMap.get(r.programId) ?? null : null,
      createdBy: r.createdById ? userMap.get(r.createdById) ?? null : null,
    }));
  }
}
