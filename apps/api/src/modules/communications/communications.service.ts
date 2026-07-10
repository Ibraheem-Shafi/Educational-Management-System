import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../../common/sms/sms.service';
import { WhatsAppService } from '../../common/sms/whatsapp.service';
import { ReportsService } from '../reports/reports.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, CommunicationsStatsResponse } from '@eims/types';
import type { FeeReminderInput, NoticeBroadcastInput, SendMessageInput } from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
    private readonly reports: ReportsService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getStats(): Promise<CommunicationsStatsResponse> {
    const cacheKey = 'communications:stats';
    const cached = this.ttlCache.get<CommunicationsStatsResponse>(cacheKey);
    if (cached) return cached;

    const thirtyAgo = thirtyDaysAgo();
    const prevStart = new Date(thirtyAgo.getTime() - 30 * 86400000);

    const [
      sent,
      sentPrev,
      failed,
      failedPrev,
      sms,
      smsPrev,
      whatsapp,
      whatsappPrev,
    ] = await Promise.all([
      this.prisma.communicationLog.count({ where: { createdAt: { gte: thirtyAgo }, status: 'sent' } }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: prevStart, lt: thirtyAgo }, status: 'sent' },
      }),
      this.prisma.communicationLog.count({ where: { createdAt: { gte: thirtyAgo }, status: 'failed' } }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: prevStart, lt: thirtyAgo }, status: 'failed' },
      }),
      this.prisma.communicationLog.count({ where: { createdAt: { gte: thirtyAgo }, channel: 'sms' } }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: prevStart, lt: thirtyAgo }, channel: 'sms' },
      }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: thirtyAgo }, channel: 'whatsapp' },
      }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: prevStart, lt: thirtyAgo }, channel: 'whatsapp' },
      }),
    ]);

    const result: CommunicationsStatsResponse = {
      sentLast30Days: countWithTrend(sent, sentPrev),
      failedLast30Days: countWithTrend(failed, failedPrev),
      smsCount: countWithTrend(sms, smsPrev),
      whatsappCount: countWithTrend(whatsapp, whatsappPrev),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }

  async sendMessage(input: SendMessageInput, user: AuthUser) {
    const result =
      input.channel === 'whatsapp'
        ? await this.whatsapp.send(input.recipient, input.body)
        : await this.sms.send(input.recipient, input.body);

    const log = await this.prisma.communicationLog.create({
      data: {
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        status: result.sent ? 'sent' : 'failed',
        metadata: result,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'communication.sent',
      entityType: 'CommunicationLog',
      entityId: log.id,
      newValue: { channel: input.channel, recipient: input.recipient },
    });

    return { log, result };
  }

  async sendFeeReminders(input: FeeReminderInput, user: AuthUser, branchId: string | null) {
    const { data: defaulters } = await this.reports.getFeeDefaulters(branchId ?? input.branchId ?? null);
    const results = [];

    for (const inv of defaulters) {
      const phone = inv.student?.phone;
      if (!phone) continue;
      const body = `Fee reminder: ${inv.student.fullName} has an outstanding balance of PKR ${inv.netAmount}. Due: ${inv.dueDate ?? 'ASAP'}.`;
      const sent = await this.sendMessage(
        { channel: input.channel, recipient: phone, body },
        user,
      );
      results.push({ student: inv.student.fullName, ...sent.result });
    }

    return { sent: results.filter((r) => r.sent).length, failed: results.filter((r) => !r.sent).length, results };
  }

  async broadcastNotice(input: NoticeBroadcastInput, user: AuthUser, branchId: string | null) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: input.noticeId, ...(branchId ? { branchId } : {}) },
    });
    if (!notice) throw new NotFoundException('Notice not found');

    const recipients: string[] = [];

    if (input.audience === 'parents' || input.audience === 'all') {
      const parents = await this.prisma.parent.findMany({
        where: { deletedAt: null, phone: { not: null } },
        select: { phone: true },
      });
      recipients.push(...parents.map((p) => p.phone!).filter(Boolean));
    }

    if (input.audience === 'students' || input.audience === 'all') {
      const students = await this.prisma.student.findMany({
        where: { deletedAt: null, phone: { not: null }, ...(branchId ? { branchId } : {}) },
        select: { phone: true },
      });
      recipients.push(...students.map((s) => s.phone!).filter(Boolean));
    }

    const unique = [...new Set(recipients)];
    const body = `${notice.title}\n\n${notice.body}`;
    const results = [];

    for (const phone of unique) {
      const sent = await this.sendMessage(
        { channel: input.channel, recipient: phone, body, subject: notice.title },
        user,
      );
      results.push(sent.result);
    }

    return {
      noticeId: notice.id,
      recipientCount: unique.length,
      sent: results.filter((r) => r.sent).length,
    };
  }

  async listLogs() {
    const logs = await this.prisma.communicationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: logs };
  }
}
