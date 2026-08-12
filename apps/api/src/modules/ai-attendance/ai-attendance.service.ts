import { prismaBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { paginatedResult } from '../../common/utils/pagination.util';
import type { AuthUser } from '@eims/types';
import type {
  AnalyzeOcrSessionInput,
  ConfirmOcrSessionInput,
  CreateOcrSessionInput,
  ListOcrSessionsQuery,
  PrepareAttendanceRegisterUploadInput,
} from '@eims/shared';
import { detectAttendanceCode, nameSimilarity } from '@eims/shared';

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

interface OcrSuggestion {
  studentId: string;
  fullName: string;
  statusCode: string;
  statusId: string | null;
  confidence: number;
  sourceLine: string | null;
}

const ATTENDANCE_BUCKET = 'attendance-registers';

@Injectable()
export class AiAttendanceService {
  private readonly logger = new Logger(AiAttendanceService.name);
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabaseAdmin = createClient(url, key);
    }
  }

  async prepareRegisterUpload(input: PrepareAttendanceRegisterUploadInput) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (!this.supabaseAdmin) {
      throw new BadRequestException(
        'File uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    await this.ensureAttendanceBucket();

    const safeName =
      input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || 'register';
    const path = `${input.branchId}/${Date.now()}-${safeName.slice(0, 120)}`;
    const { data, error } = await this.supabaseAdmin.storage
      .from(ATTENDANCE_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Could not prepare register upload');
    }

    return {
      bucket: ATTENDANCE_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  private async ensureAttendanceBucket(): Promise<void> {
    if (!this.supabaseAdmin) return;
    try {
      const { data } = await this.supabaseAdmin.storage.getBucket(ATTENDANCE_BUCKET);
      if (!data) {
        await this.supabaseAdmin.storage.createBucket(ATTENDANCE_BUCKET, { public: false });
        this.logger.log(`Created storage bucket "${ATTENDANCE_BUCKET}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not verify/create storage bucket "${ATTENDANCE_BUCKET}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async createSession(input: CreateOcrSessionInput, user: AuthUser) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, branchId: input.branchId, deletedAt: null },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const session = await this.prisma.attendanceOcrSession.create({
      data: {
        branchId: input.branchId,
        batchId: input.batchId,
        date: parseDateOnly(input.date),
        imagePath: input.imagePath,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'ai_attendance.session_created',
      entityType: 'AttendanceOcrSession',
      entityId: session.id,
      newValue: session,
    });

    return this.toResponse(session);
  }

  async analyze(id: string, input: AnalyzeOcrSessionInput, user: AuthUser, scope: BranchScope) {
    const session = await this.findSession(id, scope);
    if (session.status === 'confirmed') {
      throw new BadRequestException('Session already confirmed');
    }

    let rawText = input.rawText ?? session.rawText ?? '';
    if (!rawText.trim()) {
      rawText = await this.tryExtractTextWithOpenAi(session.imagePath);
    }
    if (!rawText.trim()) {
      throw new BadRequestException(
        'No text to analyze. Paste register text or set OPENAI_API_KEY for image OCR.',
      );
    }

    const students = await this.prisma.student.findMany({
      where: { batchId: session.batchId, branchId: session.branchId, deletedAt: null },
      orderBy: { fullName: 'asc' },
    });

    const statuses = await this.prisma.lookupStatus.findMany({
      where: { category: { code: 'attendance_status' }, isActive: true },
    });
    const statusByCode = new Map(statuses.map((s) => [s.code, s]));

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const suggestions: OcrSuggestion[] = [];
    const matched = new Set<string>();

    for (const student of students) {
      let bestLine: string | null = null;
      let bestScore = 0;

      for (const line of lines) {
        const score = nameSimilarity(student.fullName, line);
        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
        }
      }

      const detected = bestLine ? detectAttendanceCode(bestLine) : null;
      const statusCode = detected ?? 'present';
      const status = statusByCode.get(statusCode) ?? statusByCode.get('present') ?? null;

      if (bestScore >= 0.45) {
        matched.add(student.id);
        suggestions.push({
          studentId: student.id,
          fullName: student.fullName,
          statusCode,
          statusId: status?.id ?? null,
          confidence: Math.round(bestScore * 100) / 100,
          sourceLine: bestLine,
        });
      }
    }

    for (const student of students) {
      if (matched.has(student.id)) continue;
      const status = statusByCode.get('absent') ?? statusByCode.get('present');
      suggestions.push({
        studentId: student.id,
        fullName: student.fullName,
        statusCode: 'absent',
        statusId: status?.id ?? null,
        confidence: 0,
        sourceLine: null,
      });
    }

    const updated = await this.prisma.attendanceOcrSession.update({
      where: { id },
      data: { rawText, suggestions: suggestions as unknown as Prisma.InputJsonValue, status: 'analyzed' },
    });

    await this.audit.log({
      userId: user.id,
      action: 'ai_attendance.analyzed',
      entityType: 'AttendanceOcrSession',
      entityId: id,
      newValue: { suggestionCount: suggestions.length },
    });

    return this.toResponse(updated);
  }

  async confirm(id: string, input: ConfirmOcrSessionInput, user: AuthUser, scope: BranchScope) {
    const session = await this.findSession(id, scope);
    if (session.status === 'confirmed') {
      throw new BadRequestException('Session already confirmed');
    }

    const dateStr = session.date.toISOString().slice(0, 10);
    const result = await this.attendance.bulkMark(
      {
        branchId: session.branchId,
        batchId: session.batchId,
        date: dateStr,
        notifyAbsences: false,
        notifyChannel: 'sms',
        records: input.records,
      },
      user,
    );

    const updated = await this.prisma.attendanceOcrSession.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'ai_attendance.confirmed',
      entityType: 'AttendanceOcrSession',
      entityId: id,
      newValue: { marked: result.marked },
    });

    return { session: this.toResponse(updated), attendance: result };
  }

  async findOne(id: string, scope: BranchScope) {
    const session = await this.findSession(id, scope);
    return this.toResponse(session);
  }

  async list(query: ListOcrSessionsQuery, scope: BranchScope) {
    const where = prismaBranchFilter(scope);
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [sessions, total] = await Promise.all([
      this.prisma.attendanceOcrSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceOcrSession.count({ where }),
    ]);
    return paginatedResult(sessions.map((s) => this.toResponse(s)), total, page, limit);
  }

  private async findSession(id: string, scope: BranchScope) {
    const session = await this.prisma.attendanceOcrSession.findFirst({
      where: { id, ...prismaBranchFilter(scope) },
    });
    if (!session) throw new NotFoundException('OCR session not found');
    return session;
  }

  private async tryExtractTextWithOpenAi(imagePath: string): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return '';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Extract all text from this attendance register image path: ${imagePath}. Return plain text lines only with student names and P/A/L marks.`,
            },
          ],
          max_tokens: 2000,
        }),
      });
      if (!response.ok) return '';
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    } catch {
      return '';
    }
  }

  private toResponse(session: {
    id: string;
    branchId: string;
    batchId: string;
    date: Date;
    imagePath: string;
    rawText: string | null;
    status: string;
    suggestions: unknown;
    confirmedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: session.id,
      branchId: session.branchId,
      batchId: session.batchId,
      date: session.date.toISOString().slice(0, 10),
      imagePath: session.imagePath,
      rawText: session.rawText,
      status: session.status,
      suggestions: session.suggestions,
      confirmedAt: session.confirmedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
