import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type { CreateDocumentInput, ListDocumentsQuery } from '@eims/shared';

@Injectable()
export class DocumentsService {
  private supabaseAdmin;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabaseAdmin = createClient(url, key);
    }
  }

  async findAll(query: ListDocumentsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const docs = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { id: true, fullName: true } } },
    });
    return { data: docs };
  }

  async create(input: CreateDocumentInput, user: AuthUser) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const doc = await this.prisma.document.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        category: input.category,
        title: input.title,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById: user.id,
      },
      include: { student: { select: { id: true, fullName: true } } },
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
