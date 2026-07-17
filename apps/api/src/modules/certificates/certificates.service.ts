import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
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

  async findAllTemplates(query: ListTemplatesQuery, branchId: string | null) {
    await this.ensureDefaultTemplates();

    const effectiveBranchId = branchId ?? query.branchId ?? null;
    const templates = await this.prisma.certificateTemplate.findMany({
      where: {
        isActive: true,
        ...(query.type ? { type: query.type } : {}),
        OR: [{ branchId: null }, ...(effectiveBranchId ? [{ branchId: effectiveBranchId }] : [])],
      },
      orderBy: { name: 'asc' },
    });

    return { data: templates.map(this.toTemplateResponse) };
  }

  async findAllIssues(query: ListIssuesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const issues = await this.prisma.certificateIssue.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.templateId ? { templateId: query.templateId } : {}),
      },
      orderBy: { issuedAt: 'desc' },
      include: {
        template: { select: { id: true, type: true, name: true } },
        student: { select: { id: true, fullName: true } },
      },
    });

    return { data: issues.map(this.toIssueResponse) };
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

  async getPrintData(issueId: string, branchId: string | null) {
    const issue = await this.prisma.certificateIssue.findFirst({
      where: { id: issueId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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
      student: {
        id: issue.student.id,
        fullName: issue.student.fullName,
        dateOfBirth: issue.student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: issue.student.gender,
        cnicOrBForm: issue.student.cnicOrBForm,
        photographUrl: issue.student.photographUrl,
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

  async getIdCardPrintData(studentId: string, branchId: string | null) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null, ...(branchId ? { branchId } : {}) },
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

    return {
      template: template ? this.toTemplateResponse(template) : null,
      student: {
        id: student.id,
        fullName: student.fullName,
        dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: student.gender,
        cnicOrBForm: student.cnicOrBForm,
        photographUrl: student.photographUrl,
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
