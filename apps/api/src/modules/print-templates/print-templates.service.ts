import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_PRINT_TEMPLATE_FIELDS,
  DEFAULT_PRINT_TEMPLATE_NAMES,
  printDocumentTypes,
  type ListPrintTemplatesQuery,
  type PrintDocumentType,
  type UpdatePrintTemplateInput,
} from '@eims/shared';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';

@Injectable()
export class PrintTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensureDefaults(): Promise<void> {
    for (const type of printDocumentTypes) {
      const existing = await this.prisma.printDocumentTemplate.findFirst({
        where: { type, branchId: null },
      });
      if (existing) continue;
      await this.prisma.printDocumentTemplate.create({
        data: {
          type,
          branchId: null,
          name: DEFAULT_PRINT_TEMPLATE_NAMES[type],
          paperSize: type === 'id_card' ? 'a5' : type === 'fee_receipt' ? 'thermal80' : 'a4',
          fields: DEFAULT_PRINT_TEMPLATE_FIELDS[type],
          extraNote:
            type === 'fee_invoice'
              ? 'Please pay by the due date at the campus accounts office or via the online portal.'
              : null,
          isActive: true,
        },
      });
    }
  }

  async findAll(query: ListPrintTemplatesQuery) {
    await this.ensureDefaults();
    const where: Prisma.PrintDocumentTemplateWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.branchId
        ? { OR: [{ branchId: query.branchId }, { branchId: null }] }
        : { branchId: null }),
    };
    const rows = await this.prisma.printDocumentTemplate.findMany({
      where,
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    });
    // Prefer branch-specific over global when both exist
    if (query.branchId) {
      const preferred = new Map<string, (typeof rows)[0]>();
      for (const row of rows) {
        const current = preferred.get(row.type);
        if (!current || (row.branchId && !current.branchId)) {
          preferred.set(row.type, row);
        }
      }
      return [...preferred.values()].map((r) => this.toResponse(r));
    }
    return rows.map((r) => this.toResponse(r));
  }

  async findByType(type: PrintDocumentType, branchId?: string | null) {
    await this.ensureDefaults();
    if (branchId) {
      const branchTpl = await this.prisma.printDocumentTemplate.findFirst({
        where: { type, branchId, isActive: true },
      });
      if (branchTpl) return this.toResponse(branchTpl);
    }
    const global = await this.prisma.printDocumentTemplate.findFirst({
      where: { type, branchId: null, isActive: true },
    });
    if (!global) throw new NotFoundException(`Print template not found: ${type}`);
    return this.toResponse(global);
  }

  async update(id: string, input: UpdatePrintTemplateInput, user: AuthUser) {
    const existing = await this.prisma.printDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Print template not found');

    const updated = await this.prisma.printDocumentTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.paperSize !== undefined ? { paperSize: input.paperSize } : {}),
        ...(input.fields !== undefined ? { fields: input.fields } : {}),
        ...(input.headerText !== undefined ? { headerText: input.headerText } : {}),
        ...(input.footerText !== undefined ? { footerText: input.footerText } : {}),
        ...(input.extraNote !== undefined ? { extraNote: input.extraNote } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'print_template.updated',
      entityType: 'PrintDocumentTemplate',
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });

    return this.toResponse(updated);
  }

  private toResponse(row: {
    id: string;
    branchId: string | null;
    type: string;
    name: string;
    paperSize: string;
    fields: Prisma.JsonValue;
    headerText: string | null;
    footerText: string | null;
    extraNote: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const defaults =
      DEFAULT_PRINT_TEMPLATE_FIELDS[row.type as PrintDocumentType] ?? {};
    const stored =
      row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)
        ? (row.fields as Record<string, boolean>)
        : {};
    return {
      id: row.id,
      branchId: row.branchId,
      type: row.type,
      name: row.name,
      paperSize: row.paperSize,
      fields: { ...defaults, ...stored },
      headerText: row.headerText,
      footerText: row.footerText,
      extraNote: row.extraNote,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
