import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, PaginatedResponse } from '@eims/types';
import type { CreateFormFieldInput, ListFormFieldsQuery, UpdateFormFieldInput } from '@eims/shared';
import { paginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class FormFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListFormFieldsQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const activeOnly = !query.all;
    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(query.search
        ? {
            OR: [
              { label: { contains: query.search, mode: 'insensitive' as const } },
              { code: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const orderBy = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

    if (query.all) {
      const fields = await this.prisma.formField.findMany({ where, orderBy });
      return paginatedResult(fields, fields.length, 1, Math.max(fields.length, 1));
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [fields, total] = await Promise.all([
      this.prisma.formField.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.formField.count({ where }),
    ]);
    return paginatedResult(fields, total, page, limit);
  }

  async create(input: CreateFormFieldInput, user: AuthUser) {
    const existing = await this.prisma.formField.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictException('Field code already exists');

    const field = await this.prisma.formField.create({
      data: {
        code: input.code,
        label: input.label,
        fieldType: input.fieldType,
        options: input.options ?? undefined,
        isRequired: input.isRequired ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'form_field.created',
      entityType: 'FormField',
      entityId: field.id,
      newValue: field,
    });

    return field;
  }

  async update(id: string, input: UpdateFormFieldInput, user: AuthUser) {
    const existing = await this.prisma.formField.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form field not found');

    const field = await this.prisma.formField.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'form_field.updated',
      entityType: 'FormField',
      entityId: field.id,
      previousValue: existing,
      newValue: field,
    });

    return field;
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.formField.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form field not found');

    const field = await this.prisma.formField.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      userId: user.id,
      action: 'form_field.deleted',
      entityType: 'FormField',
      entityId: field.id,
      previousValue: existing,
    });

    return { deleted: true };
  }
}
