import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.module';
import { AnalyticsService } from '../analytics/analytics.service';
import { paginatedResult } from '../../common/utils/pagination.util';
import type { AtRiskStudentsQuery } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  async getAtRiskStudents(
    query: AtRiskStudentsQuery,
    branchId: string | null,
  ): Promise<PaginatedResponse<{
    studentId: string;
    fullName: string;
    attendanceRate: number | null;
    averagePercentage: number | null;
    reasons: string[];
    riskLevel: string;
  }>> {
    const threshold = query.threshold ?? 50;
    const { alerts } = await this.analytics.getWeakSubjects(
      { threshold, branchId: branchId ?? undefined },
      branchId,
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const presentStatus = await this.prisma.lookupStatus.findFirst({
      where: { code: 'present', category: { code: 'attendance_status' } },
    });

    const students = await this.prisma.student.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      select: { id: true, fullName: true, batchId: true, phone: true, email: true },
    });

    const atRisk = [];

    for (const student of students) {
      const weakSubjects = alerts.filter((a) => a.fullName === student.fullName);
      const attendanceRecords = await this.prisma.attendanceRecord.count({
        where: {
          entityType: 'student',
          entityId: student.id,
          date: { gte: thirtyDaysAgo },
        },
      });
      const presentCount = presentStatus
        ? await this.prisma.attendanceRecord.count({
            where: {
              entityType: 'student',
              entityId: student.id,
              date: { gte: thirtyDaysAgo },
              statusId: presentStatus.id,
            },
          })
        : 0;

      const attendanceRate =
        attendanceRecords > 0 ? Math.round((presentCount / attendanceRecords) * 100) : null;

      const avgRecord = await this.prisma.assessmentRecord.aggregate({
        where: { studentId: student.id, percentage: { not: null } },
        _avg: { percentage: true },
      });
      const avgPct = avgRecord._avg.percentage ? Number(avgRecord._avg.percentage) : null;

      const reasons: string[] = [];
      if (attendanceRate !== null && attendanceRate < 75) reasons.push(`Low attendance (${attendanceRate}%)`);
      if (avgPct !== null && avgPct < threshold) reasons.push(`Low average marks (${avgPct}%)`);
      if (weakSubjects.length > 0) reasons.push(`Weak in ${weakSubjects.length} subject(s)`);

      if (reasons.length > 0) {
        atRisk.push({
          studentId: student.id,
          fullName: student.fullName,
          attendanceRate,
          averagePercentage: avgPct,
          reasons,
          riskLevel: reasons.length >= 2 ? 'high' : 'medium',
        });
      }
    }

    atRisk.sort((a, b) => b.reasons.length - a.reasons.length);

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const total = atRisk.length;
    const start = (page - 1) * limit;
    const pageData = atRisk.slice(start, start + limit);

    return paginatedResult(pageData, total, page, limit);
  }

  async getStudentSummary(studentId: string, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { batch: true, program: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const { students: performance } = await this.analytics.getPerformance(
      { batchId: student.batchId ?? undefined },
      branchId,
    );
    const perf = performance.find((p) => p.studentId === studentId);

    const narrative = await this.buildNarrative(student.fullName, perf, student.batch?.name, student.program?.name);

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        batch: student.batch?.name,
        program: student.program?.name,
      },
      overallPercentage: perf?.overallPercentage ?? null,
      subjects: perf?.subjects ?? [],
      narrative,
      recommendations: this.buildRecommendations(perf?.subjects ?? []),
    };
  }

  async getParentSummary(parentEmail: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { email: parentEmail, deletedAt: null },
      include: {
        studentParents: {
          include: { student: { select: { id: true, fullName: true, branchId: true } } },
        },
      },
    });
    if (!parent) throw new NotFoundException('Parent not found');

    const children = await Promise.all(
      parent.studentParents.map(async (sp) => {
        const summary = await this.getStudentSummary(sp.student.id, sp.student.branchId);
        return {
          student: sp.student,
          relationshipCode: sp.relationshipCode,
          narrative: summary.narrative,
          overallPercentage: summary.overallPercentage,
          recommendations: summary.recommendations,
        };
      }),
    );

    return { parent: { fullName: parent.fullName }, children };
  }

  private buildRecommendations(
    subjects: Array<{ subjectName: string; averagePercentage: number | null }>,
  ) {
    return subjects
      .filter((s) => s.averagePercentage !== null && s.averagePercentage < 60)
      .map((s) => ({
        subject: s.subjectName,
        tip: `Focus on ${s.subjectName}: review past tests, practice daily problems, and ask teachers for extra help.`,
      }));
  }

  private async buildNarrative(
    fullName: string,
    perf: { overallPercentage: number | null; subjects: Array<{ subjectName: string; averagePercentage: number | null }> } | undefined,
    batchName?: string,
    programName?: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const overall = perf?.overallPercentage ?? null;
    const weak = (perf?.subjects ?? []).filter((s) => s.averagePercentage !== null && s.averagePercentage < 50);

    if (apiKey) {
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
                content: `Write a 3-sentence parent-friendly performance summary for student ${fullName} in ${programName ?? 'program'} / ${batchName ?? 'batch'}. Overall: ${overall ?? 'N/A'}%. Weak subjects: ${weak.map((s) => s.subjectName).join(', ') || 'none'}.`,
              },
            ],
            max_tokens: 300,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) return text;
        }
      } catch {
        // fall through to template
      }
    }

    if (overall === null) {
      return `${fullName} does not have enough assessment data yet for a full performance summary.`;
    }
    if (overall >= 80) {
      return `${fullName} is performing well with an overall average of ${overall}%. Keep up the consistent effort in ${batchName ?? 'their batch'}.`;
    }
    if (weak.length > 0) {
      return `${fullName}'s overall average is ${overall}%. Extra attention is recommended in ${weak.map((s) => s.subjectName).join(', ')}.`;
    }
    return `${fullName} has an overall average of ${overall}%. Steady improvement is possible with regular revision and attendance.`;
  }
}
