import { prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope, CommunicationAudience, CommunicationTemplateKey } from '@eims/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../../common/sms/sms.service';
import { WhatsAppService, type TemplateVariables } from '../../common/sms/whatsapp.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, CommunicationsStatsResponse } from '@eims/types';
import type {
  AbsenceAlertInput,
  BroadcastCampaignInput,
  FeeReminderInput,
  ListCommunicationLogsQuery,
  NoticeBroadcastInput,
  PreviewAudienceInput,
  SendMessageInput,
} from '@eims/shared';
import {
  CommunicationsAudienceService,
  type AudienceRecipient,
} from './audience.service';

const STATS_CACHE_TTL_MS = 45_000;
const SEND_CONCURRENCY = 8;

type CampaignLogMeta = {
  type?: string;
  studentId?: string;
  date?: string;
  parentId?: string;
  stub?: boolean;
  smsFallbackSent?: boolean;
  variables?: TemplateVariables;
  reason?: string;
};

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly processing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
    private readonly ttlCache: TtlCacheService,
    private readonly audience: CommunicationsAudienceService,
  ) {}

  getProviderConfig() {
    return {
      whatsappConfigured: this.whatsapp.isConfigured(),
      smsConfigured: this.sms.isConfigured(),
      templatesConfigured: {
        notice_broadcast: Boolean(this.whatsapp.getContentSid('notice_broadcast')),
        fee_reminder: Boolean(this.whatsapp.getContentSid('fee_reminder')),
        absence_alert: Boolean(this.whatsapp.getContentSid('absence_alert')),
        result_alert: Boolean(this.whatsapp.getContentSid('result_alert')),
        custom_utility: Boolean(this.whatsapp.getContentSid('custom_utility')),
      },
    };
  }

  async getStats(): Promise<CommunicationsStatsResponse> {
    const cacheKey = 'communications:stats';
    const cached = this.ttlCache.get<CommunicationsStatsResponse>(cacheKey);
    if (cached) return cached;

    const thirtyAgo = thirtyDaysAgo();
    const prevStart = new Date(thirtyAgo.getTime() - 30 * 86400000);
    const deliveredish = ['sent', 'delivered', 'read', 'fallback_sms'];

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
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: thirtyAgo }, status: { in: deliveredish } },
      }),
      this.prisma.communicationLog.count({
        where: { createdAt: { gte: prevStart, lt: thirtyAgo }, status: { in: deliveredish } },
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

  async previewAudience(input: PreviewAudienceInput, scope: BranchScope) {
    const recipients = await this.audience.resolve(scope, input);
    return { count: recipients.length };
  }

  async broadcastCampaign(input: BroadcastCampaignInput, user: AuthUser, scope: BranchScope) {
    const institutionName = await this.institutionName();
    let templateKey: CommunicationTemplateKey = input.customBody
      ? 'custom_utility'
      : input.audience === 'fee_defaulters'
        ? 'fee_reminder'
        : 'notice_broadcast';
    let subject = 'Broadcast';
    let baseVars: TemplateVariables = { institution: institutionName };
    let noticeId: string | undefined = input.noticeId;

    if (input.noticeId) {
      const notice = await this.prisma.notice.findFirst({
        where: { id: input.noticeId, ...prismaBranchFilter(scope) },
      });
      if (!notice) throw new NotFoundException('Notice not found');
      templateKey = 'notice_broadcast';
      subject = notice.title;
      baseVars = {
        institution: institutionName,
        title: notice.title,
        body: notice.body,
      };
    } else if (input.customBody?.trim()) {
      subject = input.customBody.trim().slice(0, 80);
      baseVars = { institution: institutionName, body: input.customBody.trim() };
    }

    const recipients = await this.audience.resolve(scope, {
      audience: input.audience,
      programId: input.programId,
      batchId: input.batchId,
    });

    return this.enqueueCampaign({
      channel: input.channel ?? 'whatsapp',
      templateKey,
      audience: input.audience,
      noticeId,
      programId: input.programId,
      batchId: input.batchId,
      customBody: input.customBody,
      smsFallback: Boolean(input.smsFallback),
      subject,
      baseVars,
      recipients,
      user,
      scope,
    });
  }

  async sendMessage(input: SendMessageInput, user: AuthUser) {
    const institutionName = await this.institutionName();
    const templateKey: CommunicationTemplateKey = 'custom_utility';
    const variables: TemplateVariables = {
      institution: institutionName,
      body: input.body,
      title: input.subject ?? '',
    };
    const queued = await this.enqueueCampaign({
      channel: input.channel,
      templateKey,
      audience: 'parents',
      customBody: input.body,
      smsFallback: false,
      subject: input.subject ?? 'Message',
      baseVars: variables,
      recipients: [{ phone: input.recipient, displayName: input.recipient }],
      user,
      scope: user.branchId ? selectedBranchScope([user.branchId]) : { kind: 'all' },
    });
    return { campaignId: queued.campaignId, queued: queued.queued, sent: queued.queued };
  }

  async sendFeeReminders(input: FeeReminderInput, user: AuthUser, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : input.branchId
          ? selectedBranchScope([input.branchId])
          : scope;
    const institutionName = await this.institutionName();
    const recipients = await this.audience.resolve(effective, {
      audience: 'fee_defaulters',
      programId: input.programId,
      batchId: input.batchId,
    });
    return this.enqueueCampaign({
      channel: input.channel ?? 'whatsapp',
      templateKey: 'fee_reminder',
      audience: 'fee_defaulters',
      programId: input.programId,
      batchId: input.batchId,
      smsFallback: Boolean(input.smsFallback),
      subject: 'Fee reminder',
      baseVars: { institution: institutionName },
      recipients,
      user,
      scope: effective,
    });
  }

  async sendAbsenceAlerts(input: AbsenceAlertInput, user: AuthUser) {
    const settings = await this.prisma.institutionSettings.findFirst();
    const institutionName = settings?.name ?? 'School';
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: input.studentIds },
        deletedAt: null,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        studentParents: {
          include: {
            parent: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    });

    const recipients: AudienceRecipient[] = [];
    let skipped = 0;

    for (const student of students) {
      const parents = student.studentParents.map((sp) => sp.parent).filter((p) => p.phone);
      for (const parent of parents) {
        const phone = parent.phone!;
        const alreadyLogs = await this.prisma.communicationLog.findMany({
          where: {
            channel: input.channel,
            recipient: phone,
            subject: 'Absence alert',
            createdAt: { gte: new Date(`${input.date}T00:00:00.000Z`) },
          },
          take: 40,
        });
        const already = alreadyLogs.some((log) => {
          const meta = log.metadata as CampaignLogMeta | null;
          return (
            meta?.type === 'absence_alert' &&
            meta?.studentId === student.id &&
            meta?.date === input.date
          );
        });
        if (already) {
          skipped += 1;
          continue;
        }
        recipients.push({
          phone,
          displayName: parent.fullName,
          studentId: student.id,
          studentName: student.fullName,
        });
      }
    }

    const queued = await this.enqueueCampaign({
      channel: input.channel ?? 'whatsapp',
      templateKey: 'absence_alert',
      audience: 'parents',
      smsFallback: Boolean(input.smsFallback),
      subject: 'Absence alert',
      baseVars: { institution: institutionName, date: input.date },
      recipients,
      user,
      scope: input.branchId ? selectedBranchScope([input.branchId]) : { kind: 'all' },
      extraMeta: (recipient) => ({
        type: 'absence_alert',
        studentId: recipient.studentId,
        date: input.date,
      }),
    });

    return {
      campaignId: queued.campaignId,
      sent: queued.queued,
      queued: queued.queued,
      failed: 0,
      skipped,
    };
  }

  async broadcastNotice(input: NoticeBroadcastInput, user: AuthUser, scope: BranchScope) {
    const audiences: CommunicationAudience[] =
      input.audience === 'all'
        ? ['parents', 'students', 'staff']
        : [input.audience ?? 'parents'];

    let totalQueued = 0;
    let campaignId = '';
    for (const audience of audiences) {
      const result = await this.broadcastCampaign(
        {
          channel: input.channel,
          audience,
          noticeId: input.noticeId,
          programId: input.programId,
          batchId: input.batchId,
          smsFallback: input.smsFallback,
        },
        user,
        scope,
      );
      campaignId = result.campaignId;
      totalQueued += result.queued;
    }
    return { campaignId, queued: totalQueued, sent: totalQueued, noticeId: input.noticeId };
  }

  async notifyNoticePublished(
    notice: { id: string; branchId: string; audience: string; createdById: string | null },
    user?: AuthUser,
  ) {
    const existing = await this.prisma.communicationCampaign.findFirst({
      where: { noticeId: notice.id },
      select: { id: true },
    });
    if (existing) return { campaignId: existing.id, queued: 0, skipped: true };

    const audience =
      notice.audience === 'teachers'
        ? 'staff'
        : notice.audience === 'all' ||
            notice.audience === 'parents' ||
            notice.audience === 'students' ||
            notice.audience === 'staff'
          ? notice.audience
          : 'parents';

    const actor: AuthUser = user ?? {
      id: notice.createdById || 'system',
      supabaseUserId: '',
      email: '',
      fullName: 'System',
      branchId: notice.branchId,
      roles: [],
      permissions: [],
    };

    return this.broadcastNotice(
      {
        noticeId: notice.id,
        channel: 'whatsapp',
        audience,
        smsFallback: false,
      },
      actor,
      selectedBranchScope([notice.branchId]),
    );
  }

  async sendResultAlerts(
    assessment: { id: string; name: string; branchId: string },
    user: AuthUser,
  ) {
    const already = await this.prisma.communicationCampaign.findFirst({
      where: { templateKey: 'result_alert', customBody: `assessment:${assessment.id}` },
      select: { id: true },
    });
    if (already) return { campaignId: already.id, queued: 0, skipped: true };

    const records = await this.prisma.assessmentRecord.findMany({
      where: { assessmentId: assessment.id },
      select: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentParents: {
              select: { parent: { select: { fullName: true, phone: true } } },
            },
          },
        },
      },
    });

    const recipients: AudienceRecipient[] = [];
    const seen = new Set<string>();
    for (const row of records) {
      for (const link of row.student.studentParents) {
        const phone = link.parent.phone?.trim();
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        recipients.push({
          phone,
          displayName: link.parent.fullName,
          studentId: row.student.id,
          studentName: row.student.fullName,
        });
      }
    }

    const institutionName = await this.institutionName();
    return this.enqueueCampaign({
      channel: 'whatsapp',
      templateKey: 'result_alert',
      audience: 'parents',
      customBody: `assessment:${assessment.id}`,
      smsFallback: false,
      subject: `Results: ${assessment.name}`,
      baseVars: { institution: institutionName, title: assessment.name },
      recipients,
      user,
      scope: selectedBranchScope([assessment.branchId]),
    });
  }

  async listLogs(query: ListCommunicationLogsQuery) {
    const where = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { recipient: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.communicationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { campaign: { select: { id: true, templateKey: true, audience: true } } },
      }),
      this.prisma.communicationLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async handleTwilioStatus(payload: Record<string, string>) {
    const sid = payload.MessageSid || payload.SmsSid;
    if (!sid) return { ok: false };

    const log = await this.prisma.communicationLog.findFirst({
      where: { providerMessageSid: sid },
    });
    if (!log) return { ok: false };

    const mapped = this.mapTwilioStatus(payload.MessageStatus || payload.SmsStatus);
    const errorCode = payload.ErrorCode || null;
    const nextStatus =
      mapped === 'failed' && log.channel === 'whatsapp' ? log.status : mapped;

    await this.prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: mapped === 'failed' && log.channel === 'whatsapp' ? log.status : mapped,
        errorCode,
      },
    });

    if (mapped === 'failed' && log.channel === 'whatsapp') {
      await this.trySmsFallback(log.id);
    } else if (log.campaignId) {
      await this.refreshCampaignCounts(log.campaignId);
    }

    this.ttlCache.delete('communications:stats');
    return { ok: true, status: nextStatus };
  }

  private mapTwilioStatus(status: string | undefined): string {
    switch ((status ?? '').toLowerCase()) {
      case 'queued':
      case 'accepted':
      case 'scheduled':
        return 'queued';
      case 'sending':
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
      case 'undelivered':
        return 'failed';
      default:
        return 'sent';
    }
  }

  private async institutionName(): Promise<string> {
    const settings = await this.prisma.institutionSettings.findFirst();
    return settings?.name ?? 'School';
  }

  private async enqueueCampaign(input: {
    channel: 'sms' | 'whatsapp';
    templateKey: CommunicationTemplateKey;
    audience: CommunicationAudience;
    noticeId?: string;
    programId?: string;
    batchId?: string;
    customBody?: string;
    smsFallback: boolean;
    subject: string;
    baseVars: TemplateVariables;
    recipients: AudienceRecipient[];
    user: AuthUser;
    scope: BranchScope;
    extraMeta?: (recipient: AudienceRecipient) => Record<string, unknown>;
  }) {
    const campaign = await this.prisma.communicationCampaign.create({
      data: {
        channel: input.channel,
        templateKey: input.templateKey,
        audience: input.audience,
        noticeId: input.noticeId,
        programId: input.programId,
        batchId: input.batchId,
        customBody: input.customBody,
        smsFallback: input.smsFallback,
        branchScope: input.scope as unknown as Prisma.InputJsonValue,
        queuedCount: input.recipients.length,
        createdById: input.user.id,
      },
    });

    if (input.recipients.length > 0) {
      await this.prisma.communicationLog.createMany({
        data: input.recipients.map((recipient) => {
          const variables = this.variablesFor(input.templateKey, input.baseVars, recipient);
          const body = this.whatsapp.renderSmsBody(input.templateKey, variables);
          return {
            campaignId: campaign.id,
            channel: input.channel,
            recipient: recipient.phone,
            subject: input.subject,
            body,
            status: 'queued',
            templateKey: input.templateKey,
            createdById: input.user.id,
            metadata: {
              variables,
              ...(input.extraMeta?.(recipient) ?? {}),
            } as Prisma.InputJsonValue,
          };
        }),
      });
    }

    await this.audit.log({
      userId: input.user.id,
      action: 'communication.campaign_queued',
      entityType: 'CommunicationCampaign',
      entityId: campaign.id,
      newValue: {
        channel: input.channel,
        templateKey: input.templateKey,
        audience: input.audience,
        queued: input.recipients.length,
      },
    });

    void this.processCampaign(campaign.id);
    this.ttlCache.delete('communications:stats');
    return { campaignId: campaign.id, queued: input.recipients.length, sent: input.recipients.length };
  }

  private variablesFor(
    templateKey: CommunicationTemplateKey,
    base: TemplateVariables,
    recipient: AudienceRecipient,
  ): TemplateVariables {
    return {
      ...base,
      student_name: recipient.studentName ?? recipient.displayName,
      amount: recipient.amount ?? base.amount ?? '',
      due_date: recipient.dueDate ?? base.due_date ?? '',
      body: base.body ?? '',
      title: base.title ?? '',
    };
  }

  async processCampaign(campaignId: string) {
    if (this.processing.has(campaignId)) return;
    this.processing.add(campaignId);
    try {
      const campaign = await this.prisma.communicationCampaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) return;

      const logs = await this.prisma.communicationLog.findMany({
        where: { campaignId, status: 'queued' },
      });

      let index = 0;
      const worker = async () => {
        while (index < logs.length) {
          const current = logs[index++];
          if (!current) return;
          await this.dispatchLog(current.id, campaign.smsFallback);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(SEND_CONCURRENCY, logs.length) }, () => worker()),
      );
      await this.refreshCampaignCounts(campaignId);
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} failed`, err instanceof Error ? err.stack : err);
    } finally {
      this.processing.delete(campaignId);
    }
  }

  private async dispatchLog(logId: string, smsFallback: boolean) {
    const log = await this.prisma.communicationLog.findUnique({ where: { id: logId } });
    if (!log || log.status !== 'queued') return;

    const meta = (log.metadata as CampaignLogMeta | null) ?? {};
    const templateKey = (log.templateKey ?? 'custom_utility') as CommunicationTemplateKey;
    const variables = meta.variables ?? { body: log.body };

    const result =
      log.channel === 'whatsapp'
        ? await this.whatsapp.sendTemplate({
            to: log.recipient,
            templateKey,
            variables,
          })
        : await this.sms.send(
            log.recipient,
            log.body,
            this.whatsapp.getStatusCallbackUrl(),
          );

    if (result.sent) {
      await this.prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          providerMessageSid: result.providerMessageSid,
          metadata: {
            ...meta,
            stub: 'stub' in result ? result.stub : false,
            reason: result.reason,
          },
        },
      });
      return;
    }

    if (log.channel === 'whatsapp' && smsFallback) {
      const fallback = await this.whatsapp.sendSmsFallback(log.recipient, log.body);
      if (fallback.sent) {
        await this.prisma.communicationLog.update({
          where: { id: log.id },
          data: {
            status: 'fallback_sms',
            channel: 'sms',
            providerMessageSid: fallback.providerMessageSid,
            errorCode: result.reason,
            metadata: { ...meta, smsFallbackSent: true, reason: result.reason },
          },
        });
        return;
      }
    }

    await this.prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        errorCode: result.reason,
        metadata: { ...meta, reason: result.reason },
      },
    });
  }

  private async trySmsFallback(logId: string) {
    const log = await this.prisma.communicationLog.findUnique({
      where: { id: logId },
      include: { campaign: true },
    });
    if (!log?.campaign?.smsFallback) {
      if (log?.campaignId) await this.refreshCampaignCounts(log.campaignId);
      if (log) {
        await this.prisma.communicationLog.update({
          where: { id: log.id },
          data: { status: 'failed' },
        });
      }
      return;
    }
    const meta = (log.metadata as CampaignLogMeta | null) ?? {};
    if (meta.smsFallbackSent) {
      await this.prisma.communicationLog.update({
        where: { id: log.id },
        data: { status: 'failed' },
      });
      await this.refreshCampaignCounts(log.campaignId!);
      return;
    }

    const fallback = await this.whatsapp.sendSmsFallback(log.recipient, log.body);
    await this.prisma.communicationLog.update({
      where: { id: log.id },
      data: fallback.sent
        ? {
            status: 'fallback_sms',
            channel: 'sms',
            providerMessageSid: fallback.providerMessageSid,
            metadata: { ...meta, smsFallbackSent: true },
          }
        : {
            status: 'failed',
            metadata: { ...meta, smsFallbackSent: true, reason: fallback.reason },
          },
    });
    if (log.campaignId) await this.refreshCampaignCounts(log.campaignId);
  }

  private async refreshCampaignCounts(campaignId: string) {
    const grouped = await this.prisma.communicationLog.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    const countOf = (...statuses: string[]) =>
      grouped.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        queuedCount: countOf('queued'),
        sentCount: countOf('sent', 'delivered', 'read', 'fallback_sms'),
        deliveredCount: countOf('delivered', 'read'),
        failedCount: countOf('failed'),
      },
    });
  }
}
