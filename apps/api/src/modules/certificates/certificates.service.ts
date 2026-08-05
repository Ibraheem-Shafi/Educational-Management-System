import { prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { branchIdsFromScope, selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { paginatedResult } from '../../common/utils/pagination.util';
import type { AuthUser } from '@eims/types';
import type { IssueCertificateInput, ListIssuesQuery, ListTemplatesQuery } from '@eims/shared';

const DEFAULT_TEMPLATES = [
  {
    type: 'completion_certificate',
    name: 'Completion Certificate',
    fields: {
      showProgram: true,
      showBatch: true,
      showIssueDate: true,
    },
  },
  {
    type: 'transfer_certificate',
    name: 'Transfer Certificate',
    fields: {
      showProgram: true,
      showBatch: true,
      showIssueDate: true,
      showCnic: true,
    },
  },
  {
    type: 'character_certificate',
    name: 'Character Certificate',
    fields: {
      showProgram: true,
      showBatch: true,
      showIssueDate: true,
    },
  },
  {
    type: 'id_card',
    name: 'Student ID Card',
    fields: {
      showPhoto: true,
      showProgram: true,
      showBatch: true,
    },
  },
] as const;

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async findAllTemplates(query: ListTemplatesQuery, scope: BranchScope) {
    await this.ensureDefaultTemplates();

    const scopedBranchIds =
      branchIdsFromScope(scope) ?? (query.branchId ? [query.branchId] : null);
    const where = {
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      OR: [
        { branchId: null },
        ...(scopedBranchIds ? [{ branchId: { in: scopedBranchIds } }] : []),
      ],
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [templates, total] = await Promise.all([
      this.prisma.certificateTemplate.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.certificateTemplate.count({ where }),
    ]);

    return paginatedResult(templates.map(this.toTemplateResponse), total, page, limit);
  }

  async findAllIssues(query: ListIssuesQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(effective),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.templateId ? { templateId: query.templateId } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [issues, total] = await Promise.all([
      this.prisma.certificateIssue.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          template: { select: { id: true, type: true, name: true } },
          student: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.certificateIssue.count({ where }),
    ]);

    return paginatedResult(issues.map(this.toIssueResponse), total, page, limit);
  }

  async issue(input: IssueCertificateInput, user: AuthUser) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { id: input.templateId, isActive: true },
    });
    if (!template) throw new NotFoundException('Certificate template not found');

    const title =
      input.title ??
      (template.type === 'id_card'
        ? `ID Card — ${student.fullName}`
        : template.type === 'transfer_certificate'
          ? `Transfer Certificate — ${student.fullName}`
          : template.type === 'character_certificate'
            ? `Character Certificate — ${student.fullName}`
            : `Certificate — ${student.fullName}`);

    const issue = await this.prisma.certificateIssue.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        templateId: input.templateId,
        title,
        serialNo: input.serialNo ?? null,
        issuedById: user.id,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        template: { select: { id: true, type: true, name: true } },
        student: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'certificate.issued',
      entityType: 'CertificateIssue',
      entityId: issue.id,
      newValue: issue,
    });

    return this.toIssueResponse(issue);
  }

  async getPrintData(issueId: string, scope: BranchScope) {
    const issue = await this.prisma.certificateIssue.findFirst({
      where: { id: issueId, deletedAt: null, ...prismaBranchFilter(scope) },
      include: {
        template: true,
        student: {
          include: {
            program: { select: { name: true } },
            batch: { select: { name: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!issue) throw new NotFoundException('Certificate issue not found');

    const institution = await this.settings.getInstitutionSettings();

    return {
      issue: this.toIssueResponse(issue),
      template: this.toTemplateResponse(issue.template),
      printLayout: await this.resolvePrintLayout('certificate', issue.branchId),
      student: {
        id: issue.student.id,
        fullName: issue.student.fullName,
        dateOfBirth: issue.student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: issue.student.gender,
        cnicOrBForm: issue.student.cnicOrBForm,
        photographUrl: issue.student.photographUrl,
        rollNumber: issue.student.rollNumber,
        admissionNumber: issue.student.admissionNumber,
        program: issue.student.program?.name ?? null,
        batch: issue.student.batch?.name ?? null,
        branch: issue.student.branch,
      },
      institution: {
        name: institution.name,
        logoUrl: institution.logoUrl,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
      },
    };
  }

  async getIdCardPrintData(studentId: string, scope: BranchScope) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...prismaBranchFilter(scope) },
      include: {
        program: { select: { name: true } },
        batch: { select: { name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.ensureDefaultTemplates();
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { type: 'id_card', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const institution = await this.settings.getInstitutionSettings();
    const printLayout = await this.resolvePrintLayout('id_card', student.branchId);

    return {
      template: template ? this.toTemplateResponse(template) : null,
      printLayout,
      student: {
        id: student.id,
        fullName: student.fullName,
        dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: student.gender,
        cnicOrBForm: student.cnicOrBForm,
        photographUrl: student.photographUrl,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        program: student.program?.name ?? null,
        batch: student.batch?.name ?? null,
        branch: student.branch,
      },
      institution: {
        name: institution.name,
        logoUrl: institution.logoUrl,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
      },
    };
  }

  private async resolvePrintLayout(type: 'id_card' | 'certificate', branchId: string) {
    const row = await this.prisma.printDocumentTemplate.findFirst({
      where: {
        type,
        isActive: true,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: { branchId: 'desc' },
    });
    const { DEFAULT_PRINT_TEMPLATE_FIELDS, DEFAULT_PRINT_TEMPLATE_NAMES } = await import('@eims/shared');
    const defaults = DEFAULT_PRINT_TEMPLATE_FIELDS[type];
    const stored =
      row?.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)
        ? (row.fields as Record<string, boolean>)
        : {};
    return {
      paperSize: row?.paperSize ?? (type === 'id_card' ? 'a5' : 'a4'),
      fields: { ...defaults, ...stored },
      headerText: row?.headerText ?? null,
      footerText: row?.footerText ?? null,
      name: row?.name ?? DEFAULT_PRINT_TEMPLATE_NAMES[type],
    };
  }

  private async ensureDefaultTemplates() {
    const existing = await this.prisma.certificateTemplate.findMany({
      where: { branchId: null },
      select: { type: true },
    });
    const existingTypes = new Set(existing.map((t) => t.type));
    const missing = DEFAULT_TEMPLATES.filter((t) => !existingTypes.has(t.type));
    if (missing.length === 0) return;

    await this.prisma.certificateTemplate.createMany({
      data: missing.map((t) => ({
        branchId: null,
        type: t.type,
        name: t.name,
        fields: t.fields,
        isActive: true,
      })),
    });
  }

  private toTemplateResponse(template: {
    id: string;
    branchId: string | null;
    type: string;
    name: string;
    fields: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: template.id,
      branchId: template.branchId,
      type: template.type,
      name: template.name,
      fields: template.fields,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private toIssueResponse(issue: {
    id: string;
    branchId: string;
    studentId: string;
    templateId: string;
    title: string;
    serialNo: string | null;
    issuedAt: Date;
    issuedById: string | null;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
    template?: { id: string; type: string; name: string };
    student?: { id: string; fullName: string };
  }) {
    return {
      id: issue.id,
      branchId: issue.branchId,
      studentId: issue.studentId,
      templateId: issue.templateId,
      title: issue.title,
      serialNo: issue.serialNo,
      issuedAt: issue.issuedAt.toISOString(),
      issuedById: issue.issuedById,
      meta: issue.meta,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      template: issue.template ?? null,
      student: issue.student ?? null,
    };
  }
}
