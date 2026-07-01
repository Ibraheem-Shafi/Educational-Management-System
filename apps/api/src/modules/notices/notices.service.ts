import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type { CreateNoticeInput, UpdateNoticeInput, ListNoticesQuery } from '@eims/shared';

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListNoticesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const notices = await this.prisma.notice.findMany({
      where: {
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.audience ? { audience: query.audience } : {}),
        ...(query.publishedOnly ? { isPublished: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: notices.map(this.toResponse) };
  }

  async findOne(id: string, branchId: string | null) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.toResponse(notice);
  }

  async create(input: CreateNoticeInput, user: AuthUser) {
    const notice = await this.prisma.notice.create({
      data: {
        branchId: input.branchId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        createdById: user.id,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'notice.created',
      entityType: 'Notice',
      entityId: notice.id,
      newValue: notice,
    });
    return this.toResponse(notice);
  }

  async update(id: string, input: UpdateNoticeInput, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.notice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Notice not found');

    const publishing = input.isPublished === true && !existing.isPublished;

    const notice = await this.prisma.notice.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(publishing ? { publishedAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: publishing ? 'notice.published' : 'notice.updated',
      entityType: 'Notice',
      entityId: notice.id,
      previousValue: existing,
      newValue: notice,
    });

    return this.toResponse(notice);
  }

  async remove(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.notice.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Notice not found');

    await this.prisma.notice.delete({ where: { id } });

    await this.audit.log({
      userId: user.id,
      action: 'notice.deleted',
      entityType: 'Notice',
      entityId: id,
      previousValue: existing,
    });

    return { success: true };
  }

  async getPortalNotices(user: AuthUser, branchId: string | null) {
    const audiences: string[] = ['all'];
    if (user.roles.includes('parent')) audiences.push('parents');
    if (user.roles.includes('student')) audiences.push('students');
    if (user.roles.includes('teacher')) audiences.push('teachers');
    if (user.roles.some((r) => ['branch_admin', 'receptionist', 'accountant'].includes(r))) {
      audiences.push('staff');
    }

    const notices = await this.prisma.notice.findMany({
      where: {
        isPublished: true,
        audience: { in: audiences },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    return { data: notices.map(this.toResponse) };
  }

  private toResponse(notice: {
    id: string;
    branchId: string;
    title: string;
    body: string;
    audience: string;
    isPublished: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: notice.id,
      branchId: notice.branchId,
      title: notice.title,
      body: notice.body,
      audience: notice.audience,
      isPublished: notice.isPublished,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    };
  }
}
