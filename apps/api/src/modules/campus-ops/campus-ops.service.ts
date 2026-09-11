import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { getSingleBranchId, type BranchScope } from '@eims/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { paginatedResult } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { asNumber, containsSearch, parseYmd, toIso, toYmd } from '../../common/ops/date.util';
import type { AuthUser } from '@eims/types';
import type {
  CreateComplianceControlInput,
  CreateItOutageInput,
  CreateSafetyIncidentInput,
  CreateWorkOrderInput,
  ListComplianceControlsQuery,
  ListItOutagesQuery,
  ListSafetyIncidentsQuery,
  ListWorkOrdersQuery,
  UpdateComplianceControlInput,
  UpdateItOutageInput,
  UpdateSafetyIncidentInput,
  UpdateWorkOrderInput,
} from '@eims/shared';

@Injectable()
export class CampusOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listWorkOrders(query: ListWorkOrdersQuery, scope: BranchScope) {
    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['location', 'issue', 'notes']),
    };
    return this.page(this.prisma.workOrder, where, { reportedAt: 'desc' }, query, (row) =>
      this.toWorkOrder(row),
    );
  }

  async createWorkOrder(input: CreateWorkOrderInput, user: AuthUser) {
    const row = await this.prisma.workOrder.create({
      data: {
        branchId: input.branchId,
        location: input.location,
        issue: input.issue,
        status: input.status ?? 'open',
        cost: input.cost ?? null,
        vendorBillId: input.vendorBillId ?? null,
        reportedAt: parseYmd(input.reportedAt, 'reportedAt'),
        notes: input.notes ?? null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.work_order.created',
      entityType: 'WorkOrder',
      entityId: row.id,
      newValue: row,
    });
    return this.toWorkOrder(row);
  }

  async updateWorkOrder(id: string, input: UpdateWorkOrderInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireWorkOrder(id, scope);
    const row = await this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.issue !== undefined ? { issue: input.issue } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.cost !== undefined ? { cost: input.cost } : {}),
        ...(input.vendorBillId !== undefined ? { vendorBillId: input.vendorBillId } : {}),
        ...(input.reportedAt !== undefined ? { reportedAt: parseYmd(input.reportedAt, 'reportedAt') } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.work_order.updated',
      entityType: 'WorkOrder',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toWorkOrder(row);
  }

  async removeWorkOrder(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireWorkOrder(id, scope);
    await this.prisma.workOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.work_order.deleted',
      entityType: 'WorkOrder',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  async listSafety(query: ListSafetyIncidentsQuery, scope: BranchScope) {
    const where: Prisma.SafetyIncidentWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.severity ? { severity: query.severity } : {}),
      ...containsSearch(query.search, ['summary', 'action']),
    };
    return this.page(this.prisma.safetyIncident, where, { incidentDate: 'desc' }, query, (row) =>
      this.toSafety(row),
    );
  }

  async createSafety(input: CreateSafetyIncidentInput, user: AuthUser) {
    const row = await this.prisma.safetyIncident.create({
      data: {
        branchId: input.branchId,
        incidentDate: parseYmd(input.incidentDate, 'incidentDate'),
        severity: input.severity,
        summary: input.summary,
        action: input.action ?? null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.safety.created',
      entityType: 'SafetyIncident',
      entityId: row.id,
      newValue: row,
    });
    return this.toSafety(row);
  }

  async updateSafety(id: string, input: UpdateSafetyIncidentInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireSafety(id, scope);
    const row = await this.prisma.safetyIncident.update({
      where: { id },
      data: {
        ...(input.incidentDate !== undefined
          ? { incidentDate: parseYmd(input.incidentDate, 'incidentDate') }
          : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.safety.updated',
      entityType: 'SafetyIncident',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toSafety(row);
  }

  async removeSafety(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireSafety(id, scope);
    await this.prisma.safetyIncident.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.safety.deleted',
      entityType: 'SafetyIncident',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  async listOutages(query: ListItOutagesQuery, scope: BranchScope) {
    const where: Prisma.ItOutageWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
      ...containsSearch(query.search, ['system', 'summary']),
    };
    return this.page(this.prisma.itOutage, where, { startedAt: 'desc' }, query, (row) => this.toOutage(row));
  }

  async createOutage(input: CreateItOutageInput, user: AuthUser) {
    const row = await this.prisma.itOutage.create({
      data: {
        branchId: input.branchId,
        startedAt: parseYmd(input.startedAt, 'startedAt'),
        endedAt: input.endedAt ? parseYmd(input.endedAt, 'endedAt') : null,
        system: input.system,
        summary: input.summary,
        resolved: input.resolved ?? false,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.it_outage.created',
      entityType: 'ItOutage',
      entityId: row.id,
      newValue: row,
    });
    return this.toOutage(row);
  }

  async updateOutage(id: string, input: UpdateItOutageInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireOutage(id, scope);
    const row = await this.prisma.itOutage.update({
      where: { id },
      data: {
        ...(input.startedAt !== undefined ? { startedAt: parseYmd(input.startedAt, 'startedAt') } : {}),
        ...(input.endedAt !== undefined
          ? { endedAt: input.endedAt ? parseYmd(input.endedAt, 'endedAt') : null }
          : {}),
        ...(input.system !== undefined ? { system: input.system } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.resolved !== undefined ? { resolved: input.resolved } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.it_outage.updated',
      entityType: 'ItOutage',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toOutage(row);
  }

  async removeOutage(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireOutage(id, scope);
    await this.prisma.itOutage.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.it_outage.deleted',
      entityType: 'ItOutage',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  async itStatus(query: { branchId?: string }, scope: BranchScope) {
    const branchId = getSingleBranchId(scope) ?? query.branchId;
    if (!branchId) throw new BadRequestException('A single branch is required for IT status');
    const [devices, lastPunch, openOutages] = await Promise.all([
      this.prisma.biometricDevice.findMany({
        where: { branchId, deletedAt: null },
        select: { id: true, name: true, isActive: true, lastSeenAt: true, location: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.biometricPunchLog.findFirst({
        where: { device: { branchId, deletedAt: null } },
        orderBy: { punchedAt: 'desc' },
        select: { punchedAt: true, device: { select: { name: true } } },
      }),
      this.prisma.itOutage.findMany({
        where: { branchId, deletedAt: null, resolved: false },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      branchId,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        location: d.location,
        isActive: d.isActive,
        lastSeenAt: toIso(d.lastSeenAt),
      })),
      lastBiometricPunch: lastPunch
        ? { punchedAt: toIso(lastPunch.punchedAt), device: lastPunch.device.name }
        : null,
      openOutages: openOutages.map((row) => this.toOutage(row)),
    };
  }

  async listCompliance(query: ListComplianceControlsQuery, scope: BranchScope) {
    const where: Prisma.ComplianceControlWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...containsSearch(query.search, ['title', 'category', 'notes']),
    };
    return this.page(this.prisma.complianceControl, where, { dueDate: 'asc' }, query, (row) =>
      this.toCompliance(row),
    );
  }

  async createCompliance(input: CreateComplianceControlInput, user: AuthUser) {
    const row = await this.prisma.complianceControl.create({
      data: {
        branchId: input.branchId,
        title: input.title,
        category: input.category,
        dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null,
        status: input.status ?? 'open',
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.compliance.created',
      entityType: 'ComplianceControl',
      entityId: row.id,
      newValue: row,
    });
    return this.toCompliance(row);
  }

  async updateCompliance(
    id: string,
    input: UpdateComplianceControlInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.requireCompliance(id, scope);
    const row = await this.prisma.complianceControl.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.evidenceDocumentId !== undefined
          ? { evidenceDocumentId: input.evidenceDocumentId }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.compliance.updated',
      entityType: 'ComplianceControl',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toCompliance(row);
  }

  async removeCompliance(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireCompliance(id, scope);
    await this.prisma.complianceControl.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'campus_ops.compliance.deleted',
      entityType: 'ComplianceControl',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  private async page<T, R>(
    delegate: {
      findMany: (args: object) => Promise<T[]>;
      count: (args: object) => Promise<number>;
    },
    where: object,
    orderBy: object,
    query: { page?: number; limit?: number },
    map: (row: T) => R,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      delegate.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      delegate.count({ where }),
    ]);
    return paginatedResult(rows.map(map), total, page, limit);
  }

  private async requireWorkOrder(id: string, scope: BranchScope) {
    const row = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Work order not found');
    return row;
  }

  private async requireSafety(id: string, scope: BranchScope) {
    const row = await this.prisma.safetyIncident.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Safety incident not found');
    return row;
  }

  private async requireOutage(id: string, scope: BranchScope) {
    const row = await this.prisma.itOutage.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('IT outage not found');
    return row;
  }

  private async requireCompliance(id: string, scope: BranchScope) {
    const row = await this.prisma.complianceControl.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Compliance control not found');
    return row;
  }

  private toWorkOrder(row: {
    id: string;
    branchId: string;
    location: string;
    issue: string;
    status: string;
    cost: Prisma.Decimal | number | null;
    vendorBillId: string | null;
    reportedAt: Date;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      location: row.location,
      issue: row.issue,
      status: row.status,
      cost: row.cost != null ? asNumber(row.cost) : null,
      vendorBillId: row.vendorBillId,
      reportedAt: toYmd(row.reportedAt),
      notes: row.notes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toSafety(row: {
    id: string;
    branchId: string;
    incidentDate: Date;
    severity: string;
    summary: string;
    action: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      incidentDate: toYmd(row.incidentDate),
      severity: row.severity,
      summary: row.summary,
      action: row.action,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toOutage(row: {
    id: string;
    branchId: string;
    startedAt: Date;
    endedAt: Date | null;
    system: string;
    summary: string;
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      startedAt: toIso(row.startedAt),
      endedAt: toIso(row.endedAt),
      system: row.system,
      summary: row.summary,
      resolved: row.resolved,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toCompliance(row: {
    id: string;
    branchId: string;
    title: string;
    category: string;
    dueDate: Date | null;
    status: string;
    evidenceDocumentId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      title: row.title,
      category: row.category,
      dueDate: toYmd(row.dueDate),
      status: row.status,
      evidenceDocumentId: row.evidenceDocumentId,
      notes: row.notes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }
}
