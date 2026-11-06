import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ImportJobStatus, Prisma } from '@prisma/client';
import type { ImportJobOptionsInput, ImportPipelineType } from '@eims/shared';
import { AuditService } from '../audit/audit.service';
import { ImportApplyService } from './import-apply.service';
import { ImportParseService } from './import-parse.service';
import { ImportPrismaService } from './import-prisma.service';
import { asMapping, mapRow, type RawSheetRow } from './import-row.util';

/** Small chunks so progress % advances often (UI polls ~1.5s). */
const CHUNK = 15;
/** Parallel writes within a mini-batch — not the whole file at once. */
const CONCURRENCY = 4;
const POLL_MS = 2_000;

type PendingError = {
  jobId: string;
  rowNumber: number;
  rawPayload: object;
  field?: string;
  message: string;
  code?: string;
};

@Injectable()
export class ImportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: ImportPrismaService,
    private readonly parse: ImportParseService,
    private readonly apply: ImportApplyService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    void this.recoverOrphanedJobs();
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
  }

  /** Jobs left `running` after an API restart never finish — release them. */
  private async recoverOrphanedJobs() {
    try {
      const result = await this.prisma.importJob.updateMany({
        where: { status: ImportJobStatus.running },
        data: {
          status: ImportJobStatus.failed,
          lastError:
            'Import interrupted (API restarted). Cancel or start a new import with header row 2.',
          finishedAt: new Date(),
        },
      });
      if (result.count > 0) {
        this.logger.warn(`Marked ${result.count} orphaned running import job(s) as failed`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not recover orphaned import jobs: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const claimed = await this.claimNextJob();
      if (claimed) await this.processJob(claimed.id);
    } catch (err) {
      this.logger.error(
        `Import worker tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.busy = false;
    }
  }

  private async claimNextJob() {
    const next = await this.prisma.importJob.findFirst({
      where: { status: ImportJobStatus.ready },
      orderBy: { createdAt: 'asc' },
    });
    if (!next) return null;

    // Preserve counters when resuming (processedRows > 0). Fresh starts reset in start().
    const updated = await this.prisma.importJob.updateMany({
      where: { id: next.id, status: ImportJobStatus.ready },
      data: {
        status: ImportJobStatus.running,
        startedAt: next.startedAt ?? new Date(),
        finishedAt: null,
        lastError: null,
      },
    });
    if (updated.count === 0) return null;
    return next;
  }

  async processJob(jobId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === ImportJobStatus.cancelled) return;
    if (!job.branchId) {
      await this.failJob(jobId, 'Branch is required for import jobs');
      return;
    }

    this.apply.beginJob();
    try {
      // Signal UI immediately while the sheet is parsed
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { lastError: null, percent: job.percent || 0 },
      });

      const parsed = await this.parse.parseFile({
        filePath: job.filePath,
        sheetName: job.sheetName ?? undefined,
        headerRow: job.headerRow,
      });

      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { totalRows: parsed.totalRows },
      });

      const options = (job.options ?? {}) as ImportJobOptionsInput;
      const resumeFrom = Math.max(0, Math.min(job.processedRows, parsed.rows.length));
      // Timetable replace must not re-run on resume (would wipe already-imported slots)
      if (job.pipeline === 'timetable' && resumeFrom === 0) {
        await this.apply.prepareTimetableJob(job.branchId, options.timetableMode);
      }

      const mapping = asMapping(job.mapping);
      const pipeline = job.pipeline as ImportPipelineType;
      let processed = resumeFrom;
      let success = job.successRows;
      let errors = job.errorRows;
      let skipped = job.skippedRows;

      if (resumeFrom > 0) {
        this.logger.log(
          `Resuming job ${jobId} from row index ${resumeFrom}/${parsed.rows.length}`,
        );
      }

      const flushProgress = async () => {
        const percent =
          parsed.totalRows === 0
            ? 100
            : Math.min(100, Math.floor((processed / parsed.totalRows) * 100));
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows: processed,
            successRows: success,
            errorRows: errors,
            skippedRows: skipped,
            percent,
          },
        });
      };

      for (let i = resumeFrom; i < parsed.rows.length; i += CHUNK) {
        const fresh = await this.prisma.importJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (!fresh || fresh.status === ImportJobStatus.cancelled) return;

        const slice = parsed.rows.slice(i, i + CHUNK);
        const pendingErrors: PendingError[] = [];
        const toApply: Array<{
          rowNumber: number;
          raw: RawSheetRow;
          mapped: Record<string, string>;
        }> = [];

        for (let j = 0; j < slice.length; j++) {
          const rowNumber = i + j + job.headerRow + 2;
          const raw = slice[j]!;
          const mapped = mapRow(raw, mapping.columns);
          const validation = this.apply.validateMappedRow(pipeline, mapped, mapping, options);

          if (validation && !validation.ok) {
            errors += 1;
            processed += 1;
            pendingErrors.push({
              jobId,
              rowNumber,
              rawPayload: raw as object,
              field: validation.field,
              message: validation.message,
              code: validation.code,
            });
            continue;
          }
          if (validation && validation.ok && validation.skipped) {
            skipped += 1;
            processed += 1;
            continue;
          }
          toApply.push({ rowNumber, raw, mapped });
        }

        // Prefetch for this small chunk only
        if (
          (pipeline === 'students' || pipeline === 'fee_register') &&
          toApply.length > 0 &&
          job.branchId
        ) {
          const admissions = toApply
            .map((r) => r.mapped.admissionNumber?.trim())
            .filter((a): a is string => !!a);
          await this.apply.prefetchStudents(job.branchId, admissions);

          const pairs: Array<{ programName: string; batchName: string }> = [];
          for (const r of toApply) {
            const batchName = r.mapped.batchName?.trim() || r.mapped.className?.trim();
            if (!batchName) continue;
            const programName = r.mapped.programName?.trim() || batchName;
            pairs.push({ programName, batchName });
          }
          await this.apply.prefetchProgramBatches(job.branchId, pairs);
        }

        // Mini-batches of CONCURRENCY — progress updates after each mini-batch
        for (let m = 0; m < toApply.length; m += CONCURRENCY) {
          const mini = toApply.slice(m, m + CONCURRENCY);
          const applyResults = await Promise.all(
            mini.map(async (item) => {
              const result = await this.apply.applyRow({
                pipeline,
                branchId: job.branchId!,
                raw: item.raw,
                mapping: job.mapping,
                options: job.options,
                createdById: job.createdById,
              });
              return { item, result };
            }),
          );

          for (const { item, result } of applyResults) {
            processed += 1;
            if (result.ok) {
              if (result.skipped) skipped += 1;
              else success += 1;
            } else {
              errors += 1;
              pendingErrors.push({
                jobId,
                rowNumber: item.rowNumber,
                rawPayload: item.raw as object,
                field: result.field,
                message: result.message,
                code: result.code,
              });
            }
          }

          await flushProgress();
        }

        if (pendingErrors.length > 0) {
          await this.prisma.importJobError.createMany({
            data: pendingErrors.map((e) => ({
              jobId: e.jobId,
              rowNumber: e.rowNumber,
              rawPayload: e.rawPayload as Prisma.InputJsonValue,
              field: e.field ?? null,
              message: e.message,
              code: e.code ?? null,
            })),
          });
        }

        // Also flush after validation-only rows in this chunk
        await flushProgress();
      }

      const latest = await this.prisma.importJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (latest?.status === ImportJobStatus.cancelled) return;

      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.completed,
          percent: 100,
          processedRows: processed,
          successRows: success,
          errorRows: errors,
          skippedRows: skipped,
          finishedAt: new Date(),
        },
      });

      await this.audit.log({
        userId: job.createdById,
        action: 'import.completed',
        entityType: 'ImportJob',
        entityId: jobId,
        newValue: { success, errors, skipped, pipeline: job.pipeline },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.failJob(jobId, message);
      await this.audit.log({
        userId: job.createdById,
        action: 'import.failed',
        entityType: 'ImportJob',
        entityId: jobId,
        newValue: { message },
      });
    } finally {
      this.apply.endJob();
    }
  }

  private async failJob(jobId: string, message: string) {
    try {
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.failed,
          lastError: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        `Could not mark job ${jobId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
