import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportJobStatus, type Prisma } from '@prisma/client';
import {
  IMPORT_PIPELINE_FIELDS,
  IMPORT_PIPELINE_LABELS,
  IMPORT_PIPELINES,
  isSuperAdmin,
  type CreateImportJobInput,
  type CreateImportMappingProfileInput,
  type ImportJobOptionsInput,
  type ImportPipelineType,
  type ListImportErrorsQuery,
  type ListImportJobsQuery,
  type ListImportProfilesQuery,
  type ParseImportFileInput,
  type PrepareImportUploadInput,
  type UpdateImportMappingProfileInput,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { ImportApplyService } from './import-apply.service';
import { ImportParseService } from './import-parse.service';
import { asMapping, mapRow } from './import-row.util';
import { paginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parse: ImportParseService,
    private readonly apply: ImportApplyService,
    private readonly audit: AuditService,
  ) {}

  listPipelines() {
    return IMPORT_PIPELINES.map((id) => ({
      id,
      label: IMPORT_PIPELINE_LABELS[id],
      fields: IMPORT_PIPELINE_FIELDS[id],
    }));
  }

  getPipelineFields(pipeline: ImportPipelineType) {
    if (!IMPORT_PIPELINE_FIELDS[pipeline]) {
      throw new NotFoundException('Unknown pipeline');
    }
    return {
      id: pipeline,
      label: IMPORT_PIPELINE_LABELS[pipeline],
      fields: IMPORT_PIPELINE_FIELDS[pipeline],
    };
  }

  prepareUpload(input: PrepareImportUploadInput, user: AuthUser) {
    return this.parse.prepareUpload(input, user);
  }

  async parseFile(input: ParseImportFileInput) {
    const parsed = await this.parse.parseFile(input);
    return {
      sheets: parsed.sheets,
      sheetName: parsed.sheetName,
      headerRow: parsed.headerRow,
      headerRowAutoDetected: parsed.headerRowAutoDetected,
      headers: parsed.headers,
      columnPreviews: parsed.columnPreviews,
      totalRows: parsed.totalRows,
      sampleRows: parsed.sampleRows,
    };
  }

  private resolveBranchId(user: AuthUser, requested?: string | null): string {
    if (isSuperAdmin(user.roles)) {
      if (!requested) throw new BadRequestException('branchId is required');
      return requested;
    }
    if (!user.branchId) throw new ForbiddenException('No branch assigned');
    if (requested && requested !== user.branchId) {
      throw new ForbiddenException('Cannot import into another campus');
    }
    return user.branchId;
  }

  async createJob(input: CreateImportJobInput, user: AuthUser) {
    const branchId = this.resolveBranchId(user, input.branchId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
    });
    if (!branch) throw new BadRequestException('Branch not found');

    const parsed = await this.parse.parseFile({
      filePath: input.filePath,
      sheetName: input.sheetName,
      headerRow: input.headerRow,
    });

    const job = await this.prisma.importJob.create({
      data: {
        pipeline: input.pipeline,
        branchId,
        status: ImportJobStatus.draft,
        filePath: input.filePath,
        fileName: input.fileName ?? null,
        sheetName: input.sheetName ?? parsed.sheetName,
        headerRow: input.headerRow ?? 0,
        mapping: input.mapping as object,
        options: (input.options ?? {}) as object,
        totalRows: parsed.totalRows,
        createdById: user.id,
      },
    });

    return this.toJobResponse(job);
  }

  async dryRun(jobId: string, user: AuthUser) {
    const job = await this.getJobForUser(jobId, user);
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.validating },
    });

    const parsed = await this.parse.parseFile({
      filePath: job.filePath,
      sheetName: job.sheetName ?? undefined,
      headerRow: job.headerRow,
    });
    const mapping = asMapping(job.mapping);
    const options = (job.options ?? {}) as ImportJobOptionsInput;

    let ok = 0;
    let errorCount = 0;
    const sampleErrors: Array<{ rowNumber: number; field?: string; message: string }> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const raw = parsed.rows[i]!;
      const mapped = mapRow(raw, mapping.columns);
      const validation = this.apply.validateMappedRow(
        job.pipeline as ImportPipelineType,
        mapped,
        mapping,
        options,
      );
      if (validation && !validation.ok) {
        errorCount += 1;
        if (sampleErrors.length < 25) {
          sampleErrors.push({
            rowNumber: i + job.headerRow + 2,
            field: validation.field,
            message: validation.message,
          });
        }
      } else {
        ok += 1;
      }
    }

    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        // Stay in draft until the user explicitly starts — worker only claims `ready`.
        status: ImportJobStatus.draft,
        totalRows: parsed.totalRows,
      },
    });

    return {
      job: this.toJobResponse(updated),
      preview: {
        totalRows: parsed.totalRows,
        validRows: ok,
        errorRows: errorCount,
        sampleErrors,
        canStart: true,
      },
    };
  }

  async start(jobId: string, user: AuthUser) {
    const job = await this.getJobForUser(jobId, user);
    if (job.status !== ImportJobStatus.draft && job.status !== ImportJobStatus.ready) {
      throw new BadRequestException(`Cannot start job in status ${job.status}`);
    }

    // Clear prior errors if re-running from ready after dry-run
    await this.prisma.importJobError.deleteMany({ where: { jobId: job.id } });

    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.ready,
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
        skippedRows: 0,
        percent: 0,
        lastError: null,
        finishedAt: null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'import.started',
      entityType: 'ImportJob',
      entityId: job.id,
      newValue: { pipeline: job.pipeline, branchId: job.branchId },
    });

    return this.toJobResponse(updated);
  }

  /**
   * Continue a failed/cancelled job from processedRows (skips already-applied sheet rows).
   * Upserts make overlap safe if counters lagged behind writes.
   */
  async resume(jobId: string, user: AuthUser) {
    const job = await this.getJobForUser(jobId, user);
    if (
      job.status !== ImportJobStatus.failed &&
      job.status !== ImportJobStatus.cancelled
    ) {
      throw new BadRequestException(
        `Can only resume failed or cancelled jobs (current: ${job.status})`,
      );
    }
    if (job.processedRows <= 0) {
      throw new BadRequestException(
        'Nothing to resume — use Start import for a fresh run from the beginning',
      );
    }
    if (job.totalRows > 0 && job.processedRows >= job.totalRows) {
      throw new BadRequestException('Job already processed all rows');
    }

    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.ready,
        lastError: null,
        finishedAt: null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'import.resumed',
      entityType: 'ImportJob',
      entityId: job.id,
      newValue: {
        pipeline: job.pipeline,
        branchId: job.branchId,
        resumeFrom: job.processedRows,
        totalRows: job.totalRows,
      },
    });

    return this.toJobResponse(updated);
  }

  async cancel(jobId: string, user: AuthUser) {
    const job = await this.getJobForUser(jobId, user);
    if (job.status === ImportJobStatus.cancelled) {
      return this.toJobResponse(job);
    }
    if (
      job.status !== ImportJobStatus.running &&
      job.status !== ImportJobStatus.ready &&
      job.status !== ImportJobStatus.validating
    ) {
      throw new BadRequestException(`Cannot cancel job in status ${job.status}`);
    }
    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.cancelled,
        finishedAt: new Date(),
      },
    });
    return this.toJobResponse(updated);
  }

  async getJob(jobId: string, user: AuthUser) {
    const job = await this.getJobForUser(jobId, user);
    return this.toJobResponse(job);
  }

  async listJobs(query: ListImportJobsQuery, user: AuthUser) {
    // Super Admin: all campuses (optional branchId filter). Everyone else: own branch only.
    const branchScope: Prisma.ImportJobWhereInput = isSuperAdmin(user.roles)
      ? query.branchId
        ? { branchId: query.branchId }
        : {}
      : { branchId: user.branchId ?? '__none__' };

    const where: Prisma.ImportJobWhereInput = {
      ...(query.pipeline ? { pipeline: query.pipeline } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...branchScope,
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importJob.count({ where }),
    ]);

    const branchIds = [...new Set(rows.map((r) => r.branchId).filter(Boolean))] as string[];
    const branches =
      branchIds.length > 0
        ? await this.prisma.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
    const branchById = new Map(branches.map((b) => [b.id, b]));

    return paginatedResult(
      rows.map((r) =>
        this.toJobResponse({
          ...r,
          branch: r.branchId ? (branchById.get(r.branchId) ?? null) : null,
        }),
      ),
      total,
      page,
      limit,
    );
  }

  async listErrors(jobId: string, query: ListImportErrorsQuery, user: AuthUser) {
    await this.getJobForUser(jobId, user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = { jobId };
    const [rows, total] = await Promise.all([
      this.prisma.importJobError.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importJobError.count({ where }),
    ]);
    return paginatedResult(rows, total, page, limit);
  }

  async errorsCsv(jobId: string, user: AuthUser): Promise<string> {
    await this.getJobForUser(jobId, user);
    const rows = await this.prisma.importJobError.findMany({
      where: { jobId },
      orderBy: { rowNumber: 'asc' },
      take: 20_000,
    });
    const header = 'rowNumber,field,code,message';
    const lines = rows.map((r) =>
      [r.rowNumber, r.field ?? '', r.code ?? '', csvEscape(r.message)].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async listProfiles(query: ListImportProfilesQuery, user: AuthUser) {
    const where: Prisma.ImportMappingProfileWhereInput = {
      ...(query.pipeline ? { pipeline: query.pipeline } : {}),
      ...(isSuperAdmin(user.roles)
        ? query.branchId
          ? { OR: [{ branchId: query.branchId }, { branchId: null }] }
          : {}
        : {
            OR: [{ branchId: user.branchId ?? undefined }, { branchId: null }],
          }),
    };
    return this.prisma.importMappingProfile.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async createProfile(input: CreateImportMappingProfileInput, user: AuthUser) {
    const branchId = input.branchId
      ? this.resolveBranchId(user, input.branchId)
      : isSuperAdmin(user.roles)
        ? null
        : user.branchId;
    return this.prisma.importMappingProfile.create({
      data: {
        name: input.name,
        pipeline: input.pipeline,
        branchId,
        mapping: input.mapping as object,
        options: (input.options ?? {}) as object,
        createdById: user.id,
      },
    });
  }

  async updateProfile(id: string, input: UpdateImportMappingProfileInput, user: AuthUser) {
    const profile = await this.prisma.importMappingProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (!isSuperAdmin(user.roles) && profile.branchId && profile.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot edit this profile');
    }
    return this.prisma.importMappingProfile.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.mapping ? { mapping: input.mapping as object } : {}),
        ...(input.options ? { options: input.options as object } : {}),
      },
    });
  }

  async deleteProfile(id: string, user: AuthUser) {
    const profile = await this.prisma.importMappingProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (!isSuperAdmin(user.roles) && profile.branchId && profile.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot delete this profile');
    }
    await this.prisma.importMappingProfile.delete({ where: { id } });
    return { success: true };
  }

  private async getJobForUser(jobId: string, user: AuthUser) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Import job not found');
    if (!isSuperAdmin(user.roles) && job.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot access this import job');
    }
    return job;
  }

  private toJobResponse(job: {
    id: string;
    pipeline: string;
    branchId: string | null;
    status: string;
    filePath: string;
    fileName: string | null;
    sheetName: string | null;
    headerRow: number;
    mapping: unknown;
    options: unknown;
    totalRows: number;
    processedRows: number;
    successRows: number;
    errorRows: number;
    skippedRows: number;
    percent: number;
    lastError: string | null;
    createdById: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    branch?: { id: string; name: string; code: string } | null;
  }) {
    return {
      id: job.id,
      pipeline: job.pipeline,
      pipelineLabel: IMPORT_PIPELINE_LABELS[job.pipeline as ImportPipelineType] ?? job.pipeline,
      branchId: job.branchId,
      branchName: job.branch?.name ?? null,
      branchCode: job.branch?.code ?? null,
      status: job.status,
      filePath: job.filePath,
      fileName: job.fileName,
      sheetName: job.sheetName,
      headerRow: job.headerRow,
      mapping: job.mapping,
      options: job.options,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successRows: job.successRows,
      errorRows: job.errorRows,
      skippedRows: job.skippedRows,
      percent: job.percent,
      lastError: job.lastError,
      createdById: job.createdById,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
